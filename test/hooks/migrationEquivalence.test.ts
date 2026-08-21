import assert from 'assert';
import { decideAccess } from '../../src/hooks/accessDecision';
import { MatchableRule } from '../../src/hooks/ruleMatch';
import { logger } from '../../src/logger';

/**
 * Guards the block/allow migration against changing anyone's access.
 *
 * The old model had a single `assert` type whose `negate` flag decided whether it
 * refused the people who matched or the people who did not. This re-implements
 * that evaluation verbatim from the pre-migration hook, applies the migration's
 * mapping, and asserts the two agree for every configuration that worked before.
 *
 * The one deliberate exception is documented at the bottom.
 */

interface LegacyRule {
	type: string;
	method: string;
	value: string;
	negate: boolean;
}

// Copied from src/hooks/assertRules.ts as it stood before the redesign: the
// condition is inverted by negate, and a true condition means refused.
const permittedBefore = (rules: LegacyRule[], email: string): boolean => {
	for (const rule of rules.filter((r) => r.type === 'assert')) {
		let condition = false;

		if (email) {
			if (rule.method === 'contains') condition = email.includes(rule.value);
			if (rule.method === 'equals') condition = (email === rule.value);
			if (rule.method === 'startswith') condition = email.startsWith(rule.value);
			if (rule.method === 'endswith') condition = email.endsWith(rule.value);
		}

		if (rule.negate) condition = !condition;
		if (condition) return false;
	}

	return true;
};

// Both migrations, in the order knex runs them.
//
// 20260821000000_rules_block_allow: assert becomes block or allow depending on
// negate. Rows that are not `assert` are left completely alone, negate included.
//
// 20260821000001_rules_catch_all: a tenant that ends up with any allow rule gets a
// `Block anyone` row, because an allow list now restricts only when it says so
// explicitly. Without this step an existing allow list would open on upgrade.
const migrate = (rules: LegacyRule[]): MatchableRule[] => {
	const converted: MatchableRule[] = rules.map((rule, index) => {
		const base = { id: index, tenantId: 1, parameter: 'email', method: rule.method, value: rule.value };

		if (rule.type !== 'assert') return { ...base, type: rule.type, negate: rule.negate };

		return { ...base, type: rule.negate ? 'allow' : 'block', negate: false };
	});

	if (converted.some((r) => r.type === 'allow')) {
		converted.push({
			id: 999, tenantId: 1, name: 'everyone else', type: 'block', method: 'anyone', parameter: '', value: '', negate: false
		});
	}

	return converted;
};

const permittedAfter = (rules: LegacyRule[], email: string): boolean =>
	decideAccess(migrate(rules), { email }, 'test').permitted;

const assertUnchanged = (rules: LegacyRule[], emails: string[]) => {
	for (const email of emails) {
		assert.strictEqual(
			permittedAfter(rules, email),
			permittedBefore(rules, email),
			`${email} is treated differently after the migration`
		);
	}
};

const a = (method: string, value: string, negate: boolean): LegacyRule =>
	({ type: 'assert', method, value, negate });

const SAMPLE = [ 'bob@xxx.eu', 'alice@acme.edu', 'a@gmail.com', 'a@yahoo.com', 'a@partner.org', 'bad@acme.edu' ];

describe('block/allow migration preserves existing access', () => {
	before(() => logger.transports.forEach((t) => (t.silent = true)));
	after(() => logger.transports.forEach((t) => (t.silent = false)));

	it('a single negate=false rule (a block list) is unchanged', () => {
		assertUnchanged([ a('endswith', '@xxx.eu', false) ], SAMPLE);
	});

	it('a single negate=true rule (an allow list) is unchanged', () => {
		assertUnchanged([ a('endswith', '@xxx.eu', true) ], SAMPLE);
	});

	it('several negate=false rules are unchanged', () => {
		assertUnchanged([ a('endswith', '@gmail.com', false), a('endswith', '@yahoo.com', false) ], SAMPLE);
	});

	it('an allow list with a carve-out is unchanged', () => {
		assertUnchanged([ a('endswith', '@acme.edu', true), a('equals', 'bad@acme.edu', false) ], SAMPLE);
	});

	it('every comparison method is unchanged', () => {
		for (const method of [ 'contains', 'equals', 'startswith', 'endswith' ]) {
			for (const negate of [ true, false ]) {
				assertUnchanged([ a(method, '@acme.edu', negate) ], SAMPLE);
			}
		}
	});

	it('gain rules are not touched by the migration', () => {
		const rules: LegacyRule[] = [ { type: 'gain', method: 'endswith', value: '@acme.edu', negate: true } ];

		assert.deepStrictEqual(migrate(rules)[0].type, 'gain');
		assertUnchanged(rules, SAMPLE);
	});

	it('THE ONE DELIBERATE CHANGE: two allow-list rules stop blocking everybody', () => {
		// Before, these AND-ed together (deny unless acme AND deny unless partner) so
		// the tenant could onboard nobody. This is the bug the redesign fixes, and the
		// only case where access opens up.
		const rules = [ a('endswith', '@acme.edu', true), a('endswith', '@partner.org', true) ];

		assert.strictEqual(permittedBefore(rules, 'a@acme.edu'), false, 'was refused');
		assert.strictEqual(permittedAfter(rules, 'a@acme.edu'), true, 'now admitted');

		assert.strictEqual(permittedBefore(rules, 'a@partner.org'), false, 'was refused');
		assert.strictEqual(permittedAfter(rules, 'a@partner.org'), true, 'now admitted');

		// and it does not become a free-for-all
		assert.strictEqual(permittedAfter(rules, 'a@gmail.com'), false, 'still refused');
	});
});
