import { OAuthProfile, OAuthStrategy } from '@feathersjs/authentication-oauth/lib';
import { AuthenticationRequest, AuthenticationResult } from '@feathersjs/authentication/lib';
import { Params } from '@feathersjs/feathers';
import { Forbidden, NotAuthenticated } from '@feathersjs/errors';
import qs from 'qs';
import { Application } from '../../declarations';
import { isAccessPermittedWithEmail, isStoredUnverified } from '../../hooks/accessDecision';
import { resolveAllowedOrigin } from '../allowedOrigin';
import { issueCallbackCode } from '../callbackCodes';

// roles is a VARCHAR[] on Postgres and a json column on MySQL, and has been seen as a JSON string.
// super-admin and edumeet-server (the room servers' service account) pass every tenant check.
const PRIVILEGED_ROLES = [ 'super-admin', 'edumeet-server' ];

const hasSuperAdminRole = (roles: unknown): boolean => {
	let list = roles;

	if (typeof list === 'string') {
		try {
			list = JSON.parse(list);
		} catch {
			return PRIVILEGED_ROLES.includes(list as string);
		}
	}

	return Array.isArray(list) && list.some((role) => PRIVILEGED_ROLES.includes(role));
};

export default class OAuthTenantStrategy extends OAuthStrategy {
	// Capture the OIDC id_token from the raw grant response so it can be
	// forwarded to the client and used as id_token_hint at logout time
	// (required by spec-strict OPs when post_logout_redirect_uri is sent).
	async authenticate(authentication: AuthenticationRequest, originalParams: Params) {
		// The profile must come from the provider of the tenant the user signs in to.
		// dynamicOAuth stores both together (grant provider = tenantId), so anything else
		// means the flow was not started through it.
		const grantProvider = (originalParams as Params & { session?: { grant?: { provider?: unknown } } })?.session?.grant?.provider;
		const tenantId = originalParams?.query?.tenantId;

		if (
			typeof tenantId !== 'string' || !/^[1-9]\d*$/.test(tenantId) ||
			grantProvider === undefined || String(grantProvider) !== tenantId
		) {
			throw new NotAuthenticated('OAuth provider does not match tenant');
		}

		const result = await super.authenticate(authentication, originalParams);

		if (authentication?.id_token) {
			(result as AuthenticationResult).idToken = authentication.id_token;
		}

		return result;
	}

	/**
	 * Whether the profile's e-mail address may decide anything: access and gain rules,
	 * linking to an existing account, the stored address. Either the identity provider
	 * marked it verified, or the tenant trusts the provider's addresses (trust_email),
	 * for providers that never verify but read the address from a managed directory.
	 */
	async isEmailTrusted(profile: OAuthProfile, tenantId: number): Promise<boolean> {
		if (profile?.email_verified === true || profile?.email_verified === 'true') return true;
		if (Number.isNaN(tenantId)) return false;

		const result = await (this.app as Application).service('tenantOAuths').find({
			query: { tenantId, $limit: 1 },
			provider: undefined,
		} as Params);
		const row = (Array.isArray(result) ? result[0] : result.data?.[0]) as { trust_email?: unknown } | undefined;

		return Boolean(row?.trust_email);
	}

	// name attribute can come from displayName or sn + givenName
	async getEntityQuery(profile: OAuthProfile, params: Params) {
		if (profile?.error)	throw new Error(profile.error);
		// if (!profile?.email || !params?.query?.tenantId) return {};// throw new Error('Missing paramenter(s)');
		// const paramKey = params?.query?.name_parameter;
		// const name = (paramKey ? profile[paramKey] : null) || profile.name || profile.email || '';
		
		const ssoId = profile?.sub || profile?.id;

		if (!ssoId) throw new NotAuthenticated('Identity provider profile has no sub or id');

		return { ssoId, tenantId: parseInt(params.query?.tenantId) };
	}

	// Fall back to (tenantId, email) when the ssoId lookup misses. Handles IdP
	// migrations / user recreations where an existing user gets a new `sub`:
	// without this, the create-path runs and trips the (tenantId, email) unique
	// constraint. On a hit, getEntityData rewrites ssoId to the new value.
	async findEntity(profile: OAuthProfile, params: Params) {
		const found = await super.findEntity(profile, params);

		if (found || !profile?.email || !params.query?.tenantId) return found;

		// Only link an existing account by e-mail when the identity provider says the
		// address is verified; otherwise anyone who can get that address into a profile
		// would take over the account.
		const result = await this.entityService.find({
			...params,
			query: {
				tenantId: parseInt(params.query.tenantId),
				email: profile.email,
				$limit: 1,
			},
			provider: undefined,
		});
		const existing = Array.isArray(result) ? result[0] : result.data?.[0];

		// Nor onto an account whose own address was never verified: whoever registered it
		// first with someone else's address would get that person's sign-in.
		if (existing && isStoredUnverified(existing.emailVerified)) {
			throw new NotAuthenticated('An account with this e-mail address already exists, but its address was never confirmed. Ask your administrator.');
		}

		if (existing && !await this.isEmailTrusted(profile, parseInt(params.query.tenantId))) {
			throw new NotAuthenticated('An account with this e-mail address already exists, but the identity provider did not confirm the address. Ask your administrator.');
		}

		return existing;
	}

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	async getEntityData(profile: OAuthProfile, existingEntity: any, params: Params) {
		if (!profile?.email || !params?.query?.tenantId) throw new Error('Missing paramenter(s)');
		const paramKey = params?.query?.name_parameter;
		const name = (paramKey ? profile[paramKey] : null) || profile.name || profile.email || '';

		const data: { ssoId: string, email: string, name: string, tenantId: number, emailVerified?: boolean } = {
			ssoId: profile.sub || profile.id,
			email: profile.email,
			name: name,
			tenantId: parseInt(params.query?.tenantId),
		};

		// An address the provider did not verify is the user's claim. It must not admit
		// anyone or earn a grant, and it does not replace the stored address of an
		// existing account. createEntity and updateEntity pass these params on to the
		// users service, where the gain rules read the flag.
		// A super admin manages every tenant; the tenant's admins control this identity
		// provider and could make it answer with the super admin's subject or address. Super
		// admins sign in with their password (yarn set-password).
		if (hasSuperAdminRole(existingEntity?.roles))
			throw new NotAuthenticated('A super admin account cannot sign in through a tenant\'s identity provider; use the password login.');

		const emailTrusted = await this.isEmailTrusted(profile, data.tenantId);

		(params as Params & { emailUnverified?: boolean }).emailUnverified = !emailTrusted;

		// The account remembers whether its address was vouched for, so that token refresh,
		// later grants and linking by e-mail do not trust a claim. A returning user's
		// unverified claim changes neither the address nor this flag.
		// An account from before emailVerified (null) is settled at its next sign in.
		if (emailTrusted) data.emailVerified = true;
		else if (existingEntity?.email) {
			data.email = existingEntity.email;
			if (existingEntity.emailVerified === null || existingEntity.emailVerified === undefined) data.emailVerified = false;
		} else data.emailVerified = false;

		// The tenant's access rules are applied here rather than on the users service
		// because this method is called by BOTH createEntity and updateEntity, so it
		// covers first registration and every subsequent sign in from one place. It
		// also runs before any write, so a refused user is never created and never
		// picks up grants on the way out.
		// existingEntity is the account when this is a returning user, and undefined on
		// first registration. It is what lets an administrator through a rule that
		// would otherwise refuse them; a new account cannot be an administrator yet.
		if (!Number.isNaN(data.tenantId)) {
			// An unverified address is decided as a claim (see isAccessPermittedWithEmail).
			const permitted = await isAccessPermittedWithEmail(
				this.app as Application,
				data.tenantId,
				{ ssoId: data.ssoId, name: data.name, tenantId: data.tenantId, email: profile.email },
				emailTrusted,
				'accessRules(sso)',
				existingEntity
			);

			// getRedirect() turns this into ?error=<message> on the auth callback
			if (!permitted) throw new Forbidden('Action not allowed by rule');
		}

		return data;
	}

	async getRedirect(
		data: AuthenticationResult | Error,
		params?: Params
	): Promise<string | null> {
		const redirectUrl = '/auth/callback?';
		const authResult: AuthenticationResult = data;

		if (!authResult.accessToken) {
			return `${redirectUrl}${qs.stringify({ error: data.message || 'OAuth Authentication not successful' })}`;
		}

		try {
			const origin = await resolveAllowedOrigin(
				this.app as Application,
				parseInt(params?.query?.tenantId),
				params?.query?.origin
			);
			const code = issueCallbackCode({ accessToken: authResult.accessToken, idToken: authResult.idToken, origin });

			return `${redirectUrl}${qs.stringify({ code })}`;
		} catch (error) {
			return `${redirectUrl}${qs.stringify({ error: (error as Error).message })}`;
		}
	}
}