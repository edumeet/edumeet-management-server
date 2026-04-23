import nodemailer from 'nodemailer';
import { ImapFlow } from 'imapflow';
import type { Application } from '../declarations';
import type { TenantInviteConfig } from '../services/tenantInviteConfigs/tenantInviteConfigs.schema';
import { decrypt } from './crypto';

export interface TestSide {
	ok: boolean;
	error?: string;
}

export interface TestResult {
	smtp: TestSide;
	imap?: TestSide;
}

const CONNECTION_TIMEOUT_MS = 10000;

const loadConfig = async (app: Application, tenantId: number): Promise<TenantInviteConfig> => {
	const res = await app.service('tenantInviteConfigs').find({
		paginate: false,
		query: { tenantId }
	});
	const list = Array.isArray(res) ? res : (res as { data: unknown[] }).data;
	const cfg = (list as TenantInviteConfig[])[0];

	if (!cfg) throw new Error('No invite config for this tenant');

	return cfg;
};

export const testInviteConfig = async (app: Application, tenantId: number): Promise<TestResult> => {
	const cfg = await loadConfig(app, tenantId);
	const invites = app.get('invites');

	if (!invites?.encryptionKey)
		throw new Error('invites.encryptionKey not configured');

	const result: TestResult = { smtp: { ok: false } };

	// SMTP: nodemailer.verify() opens connection + authenticates + closes.
	try {
		const transporter = nodemailer.createTransport({
			host: cfg.smtpHost,
			port: cfg.smtpPort,
			secure: cfg.smtpSecure,
			auth: {
				user: cfg.smtpUser,
				pass: cfg.smtpPass ? decrypt(cfg.smtpPass, invites.encryptionKey) : ''
			},
			connectionTimeout: CONNECTION_TIMEOUT_MS,
			greetingTimeout: CONNECTION_TIMEOUT_MS,
			socketTimeout: CONNECTION_TIMEOUT_MS
		});

		await transporter.verify();
		transporter.close();
		result.smtp = { ok: true };
	} catch (err) {
		const e = err as Error;

		result.smtp = { ok: false, error: e?.message ?? String(err) };
	}

	// IMAP: only tested when a host is configured (IMAP is optional in v1).
	if (cfg.imapHost) {
		let client: ImapFlow | undefined;

		try {
			if (!cfg.imapUser || !cfg.imapPass)
				throw new Error('IMAP user or password is empty');
			client = new ImapFlow({
				host: cfg.imapHost,
				port: cfg.imapPort ?? 993,
				secure: cfg.imapSecure ?? true,
				auth: {
					user: cfg.imapUser,
					pass: decrypt(cfg.imapPass, invites.encryptionKey)
				},
				logger: false
			});
			// Swallow async socket errors so they don't crash the process
			client.on('error', () => { /* no-op */ });
			await client.connect();
			result.imap = { ok: true };
		} catch (err) {
			// imapflow wraps server errors with generic "Command failed" as .message;
			// the actual useful detail lives on non-standard fields. Surface those.
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const e = err as any;
			const detail = e?.responseText || e?.response || e?.message || String(err);
			const code = e?.serverResponseCode ? ` [${e.serverResponseCode}]` : '';

			result.imap = { ok: false, error: `${detail}${code}` };
		} finally {
			if (client) {
				try { await client.logout(); } catch { /* noop */ }
			}
		}
	}

	return result;
};
