import assert from 'assert';
import { decideAccess } from '../../src/hooks/accessDecision';
import { MatchableRule } from '../../src/hooks/ruleMatch';
import { logger } from '../../src/logger';

const rule = (over: Partial<MatchableRule> = {}): MatchableRule => ({
	id: 1,
	name: 'r',
	tenantId: 1,
	type: 'block',
	parameter: 'email',
	method: 'endswith',
	negate: false,
	value: '@acme.edu',
	...over
});

const block = (method: string, value: string, id = 1) => rule({ id, type: 'block', method, value });
const allow = (method: string, value: string, id = 1) => rule({ id, type: 'allow', method, value });

// the catch-all: how a tenant states "refuse anyone no other rule mentions"
const shutTheRest = (id = 99) => rule({ id, type: 'block', method: 'anyone', parameter: '', value: '' });

const permits = (rules: MatchableRule[], email: string): boolean =>
	decideAccess(rules, { email }, 'test').permitted;

describe('decideAccess', () => {
	// several cases deliberately trip warnings for unevaluatable rules
	before(() => logger.transports.forEach((t) => (t.silent = true)));
	after(() => logger.transports.forEach((t) => (t.silent = false)));

	it('permits everyone when there are no rules at all', () => {
		assert.strictEqual(permits([], 'anyone@anywhere.com'), true);
	});

	it('with only Block rules, refuses matches and admits everyone else', () => {
		const rules = [ block('endswith', '@gmail.com', 1), block('endswith', '@yahoo.com', 2) ];

		assert.strictEqual(permits(rules, 'a@gmail.com'), false);
		assert.strictEqual(permits(rules, 'a@yahoo.com'), false);
		assert.strictEqual(permits(rules, 'a@acme.edu'), true);
	});

	it('an Allow rule on its own does NOT close the tenant', () => {
		// the change this design makes. Adding an exception must not silently turn the
		// tenant into an allow list, which is what caught people before.
		const rules = [ allow('equals', 'guest@partner.org') ];

		assert.strictEqual(permits(rules, 'guest@partner.org'), true);
		assert.strictEqual(permits(rules, 'anyone@anywhere.com'), true, 'still open');
	});

	it('the catch-all is what closes the tenant', () => {
		const rules = [ allow('endswith', '@acme.edu', 1), shutTheRest() ];

		assert.strictEqual(permits(rules, 'a@acme.edu'), true);
		assert.strictEqual(permits(rules, 'a@elsewhere.com'), false);
	});

	it('two Allow rules for two domains admit BOTH', () => {
		const rules = [ allow('endswith', '@acme.edu', 1), allow('endswith', '@partner.org', 2), shutTheRest() ];

		assert.strictEqual(permits(rules, 'a@acme.edu'), true);
		assert.strictEqual(permits(rules, 'a@partner.org'), true);
		assert.strictEqual(permits(rules, 'a@gmail.com'), false);
	});

	it('a Block rule CAN have an exception: an exact Allow beats a pattern Block', () => {
		// the case that motivated specificity: block a provider, admit one address
		const rules = [ block('endswith', 'gmail.com', 1), allow('equals', 'astagor@gmail.com', 2) ];

		assert.strictEqual(permits(rules, 'astagor@gmail.com'), true, 'the named exception');
		assert.strictEqual(permits(rules, 'someone@gmail.com'), false, 'the rest of the provider');
		assert.strictEqual(permits(rules, 'alice@man.poznan.pl'), true, 'unrelated, tenant is open');
	});

	it('a sub-domain carve-out still works: two patterns tie and Block wins', () => {
		const rules = [
			allow('endswith', 'man.poznan.pl', 1),
			block('endswith', 'students.man.poznan.pl', 2),
			shutTheRest()
		];

		assert.strictEqual(permits(rules, 'alice@man.poznan.pl'), true);
		assert.strictEqual(permits(rules, 'bob@students.man.poznan.pl'), false, 'matches the Allow too, Block wins');
		assert.strictEqual(permits(rules, 'eva@agh.edu.pl'), false, 'only the catch-all matches');
	});

	it('admits a whole domain except one account: an exact Block beats a pattern Allow', () => {
		const rules = [ allow('endswith', '@acme.edu', 1), block('equals', 'bad@acme.edu', 2), shutTheRest() ];

		assert.strictEqual(permits(rules, 'bad@acme.edu'), false);
		assert.strictEqual(permits(rules, 'good@acme.edu'), true);
		assert.strictEqual(permits(rules, 'a@gmail.com'), false, 'the catch-all still applies');
	});

	it('Block wins when two rules of the same specificity match', () => {
		const rules = [ allow('endswith', '@acme.edu', 1), block('endswith', '@acme.edu', 2) ];

		assert.strictEqual(permits(rules, 'a@acme.edu'), false);
	});

	it('an Allow catch-all does nothing in any configuration', () => {
		const allowAnyone = rule({ id: 50, type: 'allow', method: 'anyone', parameter: '', value: '' });

		// on its own it matches everyone, but an unmatched user is permitted anyway
		assert.strictEqual(permits([ allowAnyone ], 'a@acme.edu'), true);
		// it cannot rescue anyone from a real Block, which outranks it
		assert.strictEqual(permits([ allowAnyone, block('endswith', '@gmail.com', 1) ], 'a@gmail.com'), false);
		// and it cannot re-open a closed tenant, because a tie goes to Block
		assert.strictEqual(permits([ allowAnyone, shutTheRest() ], 'a@acme.edu'), false);
	});

	it('a real rule always outranks the catch-all', () => {
		assert.strictEqual(permits([ allow('endswith', '@acme.edu', 1), shutTheRest() ], 'a@acme.edu'), true);
		assert.strictEqual(permits([ block('endswith', '@acme.edu', 1), rule({ id: 99, type: 'allow', method: 'anyone', parameter: '', value: '' }) ], 'a@acme.edu'), false);
	});

	it('a tenant whose only Allow rule is unevaluatable stays OPEN', () => {
		const typo = rule({ type: 'allow', parameter: 'emial' });

		assert.strictEqual(permits([ typo ], 'anyone@anywhere.com'), true);
	});

	it('an unevaluatable Block rule refuses nobody', () => {
		assert.strictEqual(permits([ rule({ type: 'block', parameter: 'emial' }) ], 'a@acme.edu'), true);
	});

	it('an unevaluatable Allow alongside a working one behaves as a normal allow list', () => {
		const rules = [ rule({ id: 1, type: 'allow', parameter: 'emial' }), allow('endswith', '@acme.edu', 2), shutTheRest() ];

		assert.strictEqual(permits(rules, 'a@acme.edu'), true);
		assert.strictEqual(permits(rules, 'a@gmail.com'), false);
	});

	it('an unknown method makes a rule unevaluatable rather than matching', () => {
		assert.strictEqual(permits([ rule({ type: 'allow', method: 'matches' }) ], 'a@acme.edu'), true);
	});

	it('the catch-all is never treated as unevaluatable despite having no parameter', () => {
		// it must be answered before matchRule's missing-parameter check, or an allow
		// list would silently fail open
		assert.strictEqual(permits([ allow('endswith', '@acme.edu', 1), shutTheRest() ], 'a@gmail.com'), false);
	});

	it('reports which rule refused', () => {
		const decision = decideAccess([ block('endswith', '@gmail.com', 7) ], { email: 'a@gmail.com' }, 'test');

		assert.strictEqual(decision.permitted, false);
		assert.strictEqual(decision.rule?.id, 7);
	});

	it('still honours negate on rules written before it was withdrawn', () => {
		const legacy = rule({ type: 'allow', method: 'endswith', value: '@gmail.com', negate: true });

		assert.strictEqual(permits([ legacy, shutTheRest() ], 'alice@acme.edu'), true);
		assert.strictEqual(permits([ legacy, shutTheRest() ], 'other@gmail.com'), false);
	});

	it('accepts the 0/1 mysql2 returns for a tinyint negate', () => {
		const rules = [ rule({ type: 'allow', method: 'endswith', value: '@gmail.com', negate: 1 }), shutTheRest() ];

		assert.strictEqual(permits(rules, 'a@acme.edu'), true, 'not gmail, so allowed');
		assert.strictEqual(permits(rules, 'a@gmail.com'), false, 'gmail, so not allowed');
	});
});
