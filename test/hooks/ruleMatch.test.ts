import assert from 'assert';
import { MatchableRule, findTenantRules, matchRule } from '../../src/hooks/ruleMatch';
import { logger } from '../../src/logger';

const rule = (over: Partial<MatchableRule> = {}): MatchableRule => ({
	id: 1,
	name: 'test rule',
	tenantId: 1,
	parameter: 'email',
	method: 'endswith',
	negate: false,
	value: '@example.com',
	...over
});

describe('matchRule', () => {
	it('supports every method', () => {
		const data = { email: 'someone@example.com' };

		assert.strictEqual(matchRule(rule({ method: 'endswith', value: '@example.com' }), data), true);
		assert.strictEqual(matchRule(rule({ method: 'endswith', value: '@other.org' }), data), false);

		assert.strictEqual(matchRule(rule({ method: 'startswith', value: 'someone' }), data), true);
		assert.strictEqual(matchRule(rule({ method: 'startswith', value: 'nobody' }), data), false);

		assert.strictEqual(matchRule(rule({ method: 'contains', value: 'example' }), data), true);
		assert.strictEqual(matchRule(rule({ method: 'contains', value: 'nothing' }), data), false);

		assert.strictEqual(matchRule(rule({ method: 'equals', value: 'someone@example.com' }), data), true);
		assert.strictEqual(matchRule(rule({ method: 'equals', value: 'someone@' }), data), false);
	});

	it('inverts the result when negate is set', () => {
		const data = { email: 'someone@example.com' };

		assert.strictEqual(matchRule(rule({ negate: true }), data), false);
		assert.strictEqual(matchRule(rule({ negate: true, value: '@other.org' }), data), true);
	});

	it('returns undefined when the parameter is absent from the data', () => {
		assert.strictEqual(matchRule(rule({ parameter: 'emial' }), { email: 'a@example.com' }), undefined);
		assert.strictEqual(matchRule(rule(), { email: undefined }), undefined);
		assert.strictEqual(matchRule(rule(), { email: null }), undefined);
		assert.strictEqual(matchRule(rule(), { email: '' }), undefined);
	});

	it('returns undefined when the rule has no parameter or an unknown method', () => {
		assert.strictEqual(matchRule(rule({ parameter: null }), { email: 'a@example.com' }), undefined);
		assert.strictEqual(matchRule(rule({ method: 'matches' }), { email: 'a@example.com' }), undefined);
	});

	it('does not let negate turn an unevaluatable rule into a match', () => {
		// A typo'd parameter on a negated rule used to match every user, which locked
		// the whole tenant out of an assert rule.
		assert.strictEqual(matchRule(rule({ parameter: 'emial', negate: true }), { email: 'a@example.com' }), undefined);
		assert.strictEqual(matchRule(rule({ method: 'matches', negate: true }), { email: 'a@example.com' }), undefined);
	});

	it('accepts the 0/1 mysql2 returns for a tinyint negate', () => {
		const data = { email: 'someone@example.com' };

		assert.strictEqual(matchRule(rule({ negate: 1 }), data), false);
		assert.strictEqual(matchRule(rule({ negate: 0 }), data), true);
	});

	it('compares non-string attributes on their string form', () => {
		assert.strictEqual(matchRule(rule({ parameter: 'ssoId', method: 'startswith', value: '12' }), { ssoId: 1234 }), true);
		assert.strictEqual(matchRule(rule({ parameter: 'ssoId', method: 'equals', value: '1234' }), { ssoId: 1234 }), true);
	});

	it('treats a null value as an empty needle instead of throwing', () => {
		assert.strictEqual(matchRule(rule({ method: 'contains', value: null }), { email: 'a@example.com' }), true);
	});
});

describe('findTenantRules', () => {
	const rows = [
		{ id: 1, type: 'block' },
		{ id: 2, type: 'gain' },
		{ id: 3, type: 'allow' },
		{ id: 4, type: 'Gain' },
		{ id: 5, type: null }
	];

	const find = async (query: Record<string, unknown>) => {
		seenQuery = query;

		return rows;
	};

	let seenQuery: Record<string, unknown> = {};
	let warnings: string[] = [];
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let originalWarn: any;

	before(() => {
		originalWarn = logger.warn;
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		(logger as any).warn = (message: string) => warnings.push(message);
	});
	after(() => ((logger as { warn: unknown }).warn = originalWarn));
	beforeEach(() => (warnings = []));

	it('selects only the rules of the requested types', async () => {
		assert.deepStrictEqual((await findTenantRules(find, 'test', 1, [ 'block', 'allow' ])).map((r) => r.id), [ 1, 3 ]);
		assert.deepStrictEqual((await findTenantRules(find, 'test', 1, [ 'gain' ])).map((r) => r.id), [ 2 ]);
	});

	it('queries by tenant without a type filter, so odd types stay visible', async () => {
		await findTenantRules(find, 'test', 42, [ 'gain' ]);

		assert.deepStrictEqual(seenQuery, { tenantId: 42 });
	});

	it('warns about a rule whose type is not a recognised one', async () => {
		await findTenantRules(find, 'test', 1, [ 'block', 'allow' ]);

		// ids 4 ("Gain") and 5 (null) can never run; id 2 is a valid gain rule
		assert.strictEqual(warnings.length, 2);
		assert.ok(warnings.every((w) => w.includes('unknown type')));
	});
});
