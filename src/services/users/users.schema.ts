// For more information about this file see https://dove.feathersjs.com/guides/cli/service.schemas.html
import { resolve, virtual } from '@feathersjs/schema';
import { Type, getValidator, querySyntax } from '@feathersjs/typebox';
import type { Static } from '@feathersjs/typebox';
import { passwordHash } from '@feathersjs/authentication-local';

import type { HookContext } from '../../declarations';
import { dataValidator, queryValidator } from '../../validators';

// Main data model schema
export const userSchema = Type.Object(
	{
		id: Type.Number(),
		ssoId: Type.Optional(Type.String()),
		tenantId: Type.Optional(Type.Number()),
		email: Type.String(),
		password: Type.Optional(Type.String()),
		name: Type.Optional(Type.String()),
		avatar: Type.Optional(Type.String()),
		tenantAdmin: Type.Boolean(),
		tenantOwner: Type.Boolean(),
		roles: Type.Optional(Type.Array(Type.String())),
	},
	{ $id: 'User', additionalProperties: false }
);
export type User = Static<typeof userSchema>
export const userResolver = resolve<User, HookContext>({
	tenantAdmin: virtual(async (user, context) => {
		const { total } = await context.app.service('tenantAdmins').find({
			query: {
				tenantId: user.tenantId,
				userId: user.id
			}
		});

		return total > 0;
	}),
	tenantOwner: virtual(async (user, context) => {
		const { total } = await context.app.service('tenantOwners').find({
			query: {
				tenantId: user.tenantId,
				userId: user.id
			}
		});

		return total > 0;
	})
});

export const userExternalResolver = resolve<User, HookContext>({
	// The password should never be visible externally
	password: async () => undefined,

	email: async (value, user, context) => {
		const u = context.params.user as any;

		if (!u) return null;

		const isSelf = String(u.id) === String((user as any).id);
		const canSeeAll = !!u.tenantAdmin || !!u.tenantOwner || !!u.superAdmin;

		if (canSeeAll || isSelf) return value;

		return null;
	},

	ssoId: async (value, user, context) => {
		const u = context.params.user as any;

		if (!u) return null;

		const isSelf = String(u.id) === String((user as any).id);
		const canSeeAll = !!u.tenantAdmin || !!u.tenantOwner || !!u.superAdmin;

		if (canSeeAll || isSelf) return value;

		return null;
	}
});

// Schema for creating new users
export const userDataSchema = Type.Pick(
	Type.Required(userSchema),
	[ 'email', 'password', 'tenantId' ], {
		$id: 'UserData',
		additionalProperties: false
	}
);
export const userDataAdminSchema = Type.Intersect([
	Type.Pick(userSchema, [ 'email', 'password' ], { additionalProperties: false }),
	Type.Partial(Type.Omit(userSchema, [ 'email', 'password' ]), { additionalProperties: false })
], { $id: 'UserDataAdmin', additionalProperties: false });
export type UserData = Static<typeof userDataSchema>
export const userDataValidator = getValidator(userDataSchema, dataValidator);
export const userDataAdminValidator = getValidator(userDataAdminSchema, dataValidator);
export const userDataResolver = resolve<User, HookContext>({
	password: passwordHash({ strategy: 'local' })
});

export const userPatchAdminSchema = Type.Partial(userSchema, { $id: 'RoomPatchAdmin' });

// Schema for updating existing users
export const userPatchSchema = Type.Partial(Type.Omit(
	userSchema,
	[ 'email', 'tenantId', 'ssoId', 'tenantAdmin', 'tenantOwner' ]),
{ $id: 'UserPatch' }
);
export type UserPatch = Static<typeof userPatchSchema>
export const userPatchValidator = getValidator(userPatchSchema, dataValidator);
export const userPatchAdminValidator = getValidator(userPatchAdminSchema, dataValidator);
export const userPatchResolver = resolve<User, HookContext>({
	password: passwordHash({ strategy: 'local' })
});

// Schema for allowed query properties
export const userQueryProperties = Type.Pick(userSchema, [ 'id', 'ssoId', 'tenantId', 'email' ]);
export const userQuerySchema = Type.Intersect(
	[
		querySyntax(userQueryProperties),
		// Add additional query properties here
		Type.Object({}, { additionalProperties: false })
	],
	{ additionalProperties: false }
);
export type UserQuery = Static<typeof userQuerySchema>
export const userQueryValidator = getValidator(userQuerySchema, queryValidator);
export const userQueryResolver = resolve<UserQuery, HookContext>({
	// Authenticated users can only query within their tenant
	tenantId: async (value, query, context) => {
		if (context.params.user?.tenantId != null) {
			return parseInt(String(context.params.user.tenantId));
		}
		return value;
	}
});

export const userTenantManagerQueryResolver = resolve<UserQuery, HookContext>({
	// If there is a user (TenantAdmin/Owner), they are allowed to see their own tenant data
	tenantId: async (value, query, context) => {
		if (context.params.user?.tenantId)
			return context.params.user.tenantId;

		return value;
	}
});
