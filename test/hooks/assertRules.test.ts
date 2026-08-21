import assert from 'assert';
import { assertRules } from '../../src/hooks/assertRules';
import { logger } from '../../src/logger';

interface FakeRule {
	id?: number;
	name?: string;
	tenantId?: number;
	type?: string;
	parameter?: string;
	method?: string;
	negate?: boolean;
	value?: string;
}

const rule = (over: Partial<FakeRule> = {}): FakeRule => ({
	id: 1,
	name: 'test rule',
	tenantId: 1,
	type: 'assert',
	parameter: 'email',
	method: 'endswith',
	negate: false,
	value: '@example.com',
	...over
});

// The hook only ever touches context.data and context.app.service('rules'), so a
// hand-built context keeps these tests free of the database the service tests need.
// eslint-disable-next-line @typescript-eslint/no-explicit-any, no-unused-vars
const makeContext = (rules: FakeRule[], data: Record<string, unknown>, onService?: (name: string) => void): any => ({
	method: 'create',
	data,
	app: {
		service: (name: string) => {
			onService?.(name);

			return { find: async () => rules };
		}
	}
});

describe('assertRules hook', () => {
	// These cases deliberately trip warnings; keep the mocha output readable.
	before(() => logger.transports.forEach((t) => (t.silent = true)));
	after(() => logger.transports.forEach((t) => (t.silent = false)));

	it('does not look up rules when the data carries no tenantId', async () => {
		let looked = false;

		await assertRules(makeContext([ rule() ], { email: 'someone@example.com' }, () => (looked = true)));

		assert.strictEqual(looked, false, 'local admin creates must not be gated by tenant rules');
	});

	it('blocks creation when a rule matches', async () => {
		await assert.rejects(
			assertRules(makeContext([ rule() ], { tenantId: 1, email: 'someone@example.com' })),
			/Action not allowed by rule/
		);
	});

	it('rejects with a 403 rather than a 500', async () => {
		await assertRules(makeContext([ rule() ], { tenantId: 1, email: 'someone@example.com' })).then(
			() => assert.fail('expected the hook to reject'),
			(err) => assert.strictEqual(err.code, 403)
		);
	});

	it('allows creation when no rule matches', async () => {
		await assert.doesNotReject(
			assertRules(makeContext([ rule() ], { tenantId: 1, email: 'someone@other.org' }))
		);
	});

	it('allows creation when the tenant has no rules', async () => {
		await assert.doesNotReject(assertRules(makeContext([], { tenantId: 1, email: 'someone@example.com' })));
	});

	it('applies negate, so a rule can express "only this domain may sign up"', async () => {
		const onlyExample = rule({ negate: true });

		await assert.doesNotReject(
			assertRules(makeContext([ onlyExample ], { tenantId: 1, email: 'someone@example.com' }))
		);
		await assert.rejects(
			assertRules(makeContext([ onlyExample ], { tenantId: 1, email: 'someone@other.org' }))
		);
	});

	it('skips a rule whose parameter is missing, even when negated', async () => {
		// Regression guard: a typo'd parameter on a negated rule used to match every
		// user and lock the entire tenant out.
		const typo = rule({ parameter: 'emial', negate: true });

		await assert.doesNotReject(
			assertRules(makeContext([ typo ], { tenantId: 1, email: 'someone@example.com' }))
		);
	});

	it('skips a rule with an unknown method, even when negated', async () => {
		const bogus = rule({ method: 'matches', negate: true });

		await assert.doesNotReject(
			assertRules(makeContext([ bogus ], { tenantId: 1, email: 'someone@example.com' }))
		);
	});

	it('ignores rules of another type', async () => {
		const others = [ rule({ type: 'gain' }), rule({ type: 'Assert' }) ];

		await assert.doesNotReject(
			assertRules(makeContext(others, { tenantId: 1, email: 'someone@example.com' }))
		);
	});

	it('blocks as soon as any one of several rules matches', async () => {
		const rules = [ rule({ id: 1, value: '@nope.org' }), rule({ id: 2, value: '@example.com' }) ];

		await assert.rejects(assertRules(makeContext(rules, { tenantId: 1, email: 'someone@example.com' })));
	});
});
