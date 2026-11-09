import assert from 'assert';
import { stripLocks, tenantDefault } from '../../src/hooks/tenantDefault';

// A tenant admin's patch of its own defaults row. The stored row is what the super administrator
// set; MySQL hands booleans back as 0 and 1, so rows are given in both forms.
const makeContext = (stored: Record<string, unknown>, data: Record<string, unknown>) => ({
	id: 4,
	data: { ...data },
	params: { provider: 'rest', user: { id: 9, tenantId: 1 } },
	app: {
		service: (name: string) => {
			if (name === 'defaults') return { get: async (id: number) => ({ id, tenantId: 1, ...stored }) };
			throw new Error(`unexpected service ${name}`);
		}
	}
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
}) as any;

const ALL_LOCKS = [
	'disableUnmanagedLock', 'endToEndEncryptionLock', 'lockedLock', 'raiseHandEnabledLock', 'reactionsEnabledLock',
	'localRecordingEnabledLock', 'chatEnabledLock', 'breakoutsEnabledLock', 'filesharingEnabledLock',
];

describe('tenantDefault hook', () => {
	it('keeps a locked setting and its lock when a tenant admin tries to withdraw both', async () => {
		const context = makeContext(
			{ endToEndEncryption: true, endToEndEncryptionLock: true },
			{ endToEndEncryptionLock: false, endToEndEncryption: false }
		);

		await tenantDefault(context);

		assert.strictEqual(context.data.endToEndEncryption, true);
		assert.ok(!('endToEndEncryptionLock' in context.data));
	});

	it('ignores every lock a tenant admin sends, also setting one that is not set', async () => {
		const context = makeContext({}, Object.fromEntries(ALL_LOCKS.map((lock) => [ lock, true ])));

		await tenantDefault(context);

		assert.deepStrictEqual(Object.keys(context.data).filter((key) => key.endsWith('Lock')), []);
	});

	it('pins every locked value, reactions included, from a MySQL row of zeros and ones', async () => {
		const context = makeContext(
			{ reactionsEnabledUnmanaged: 1, reactionsEnabledLock: 1, chatEnabledUnmanaged: 0, chatEnabledLock: 1 },
			{ reactionsEnabledUnmanaged: false, chatEnabledUnmanaged: true }
		);

		await tenantDefault(context);

		assert.strictEqual(context.data.reactionsEnabledUnmanaged, true);
		assert.strictEqual(context.data.chatEnabledUnmanaged, false);
	});

	it('lets a tenant admin change what is not locked', async () => {
		const context = makeContext(
			{ endToEndEncryption: false, endToEndEncryptionLock: false, reactionsEnabledLock: false },
			{ endToEndEncryption: true, reactionsEnabledUnmanaged: false, chatEnabledUnmanaged: true }
		);

		await tenantDefault(context);

		assert.strictEqual(context.data.endToEndEncryption, true);
		assert.strictEqual(context.data.reactionsEnabledUnmanaged, false);
		assert.strictEqual(context.data.chatEnabledUnmanaged, true);
	});
});

describe('stripLocks hook', () => {
	it('drops the locks from a tenant admin\'s new defaults row and keeps the rest', () => {
		const context = { data: { tenantId: 1, endToEndEncryption: true, endToEndEncryptionLock: true, chatEnabledLock: true } };

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		stripLocks(context as any);

		assert.deepStrictEqual(context.data, { tenantId: 1, endToEndEncryption: true });
	});
});
