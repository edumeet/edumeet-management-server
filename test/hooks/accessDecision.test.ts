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

	it('two Allow rules for two domains admit BOTH', () => {
		// the regression that motivated the redesign: as one negated assert type
		// these AND-ed together and blocked everybody
		const rules = [ allow('endswith', '@acme.edu', 1), allow('endswith', '@partner.org', 2) ];

		assert.strictEqual(permits(rules, 'a@acme.edu'), true);
		assert.strictEqual(permits(rules, 'a@partner.org'), true);
		assert.strictEqual(permits(rules, 'a@gmail.com'), false);
	});

	it('an Allow list refuses anyone it does not name', () => {
		assert.strictEqual(permits([ allow('endswith', '@acme.edu') ], 'a@elsewhere.com'), false);
	});

	it('admits a domain plus one outside collaborator, as two Allow rules', () => {
		// the natural spelling: an allow list is a list, so the collaborator is just
		// another entry. No Block rule and so no precedence question.
		const rules = [ allow('endswith', '@acme.edu', 1), allow('equals', 'test@gmail.com', 2) ];

		assert.strictEqual(permits(rules, 'alice@acme.edu'), true);
		assert.strictEqual(permits(rules, 'test@gmail.com'), true, 'the collaborator');
		assert.strictEqual(permits(rules, 'other@gmail.com'), false, 'the rest of their provider');
	});

	it('a Block rule cannot have exceptions', () => {
		// documents why the collaborator case must be written as Allow rules: this
		// spelling refuses everyone. test@ because Block wins, and the rest because
		// the Allow rule closed the tenant.
		const rules = [ block('endswith', '@gmail.com', 1), allow('equals', 'test@gmail.com', 2) ];

		assert.strictEqual(permits(rules, 'test@gmail.com'), false, 'Block wins');
		assert.strictEqual(permits(rules, 'other@gmail.com'), false);
		assert.strictEqual(permits(rules, 'alice@acme.edu'), false, 'the Allow closed the tenant');
	});

	it('still honours negate on rules written before it was withdrawn', () => {
		// the comparison is no longer offered, but the column is still read, so an
		// existing row must keep behaving exactly as it did
		const legacy = rule({ type: 'allow', method: 'endswith', value: '@gmail.com', negate: true });

		assert.strictEqual(permits([ legacy ], 'alice@acme.edu'), true);
		assert.strictEqual(permits([ legacy ], 'other@gmail.com'), false);
	});

	it('admits a whole domain except one account, using Allow plus Block', () => {
		const rules = [ allow('endswith', '@acme.edu', 1), block('equals', 'bad@acme.edu', 2) ];

		assert.strictEqual(permits(rules, 'bad@acme.edu'), false);
		assert.strictEqual(permits(rules, 'good@acme.edu'), true);
		assert.strictEqual(permits(rules, 'a@gmail.com'), false, 'an allow list still applies');
	});

	it('Block wins over a matching Allow', () => {
		const rules = [ allow('endswith', '@acme.edu', 1), block('endswith', '@acme.edu', 2) ];

		assert.strictEqual(permits(rules, 'a@acme.edu'), false);
	});

	it('a Block rule still applies when no Allow rules exist', () => {
		assert.strictEqual(permits([ block('endswith', '@gmail.com') ], 'a@gmail.com'), false);
		assert.strictEqual(permits([ block('endswith', '@gmail.com') ], 'a@acme.edu'), true);
	});

	it('a tenant whose only Allow rule is unevaluatable stays OPEN', () => {
		// the lock-everyone-out trap: an unevaluatable rule must not count towards
		// "an allow list exists", or one typo takes the tenant down
		const typo = rule({ type: 'allow', parameter: 'emial' });

		assert.strictEqual(permits([ typo ], 'anyone@anywhere.com'), true);
	});

	it('an unevaluatable Block rule refuses nobody', () => {
		assert.strictEqual(permits([ rule({ type: 'block', parameter: 'emial' }) ], 'a@acme.edu'), true);
	});

	it('an unevaluatable Allow alongside a working one behaves as a normal allow list', () => {
		const rules = [ rule({ id: 1, type: 'allow', parameter: 'emial' }), allow('endswith', '@acme.edu', 2) ];

		assert.strictEqual(permits(rules, 'a@acme.edu'), true);
		assert.strictEqual(permits(rules, 'a@gmail.com'), false);
	});

	it('an unknown method makes a rule unevaluatable rather than matching', () => {
		assert.strictEqual(permits([ rule({ type: 'allow', method: 'matches' }) ], 'a@acme.edu'), true);
	});

	it('reports which rule refused', () => {
		const decision = decideAccess([ block('endswith', '@gmail.com', 7) ], { email: 'a@gmail.com' }, 'test');

		assert.strictEqual(decision.permitted, false);
		assert.strictEqual(decision.rule?.id, 7);
	});

	it('accepts the 0/1 mysql2 returns for a tinyint negate', () => {
		const rules = [ rule({ type: 'allow', method: 'endswith', value: '@gmail.com', negate: 1 }) ];

		assert.strictEqual(permits(rules, 'a@acme.edu'), true, 'not gmail, so allowed');
		assert.strictEqual(permits(rules, 'a@gmail.com'), false, 'gmail, so not allowed');
	});
});
