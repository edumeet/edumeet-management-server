import assert from 'assert';
import knexLib, { Knex } from 'knex';

/**
 * The rules migration has to run on both Postgres and MySQL - both drivers are
 * dependencies and the initial migration branches on the client for column types.
 *
 * This builds the migration's statements with knex's real query compiler for each
 * dialect and asserts they differ ONLY in how identifiers are quoted. That is a
 * precise way of saying "portable": if anyone later reaches for a Postgres-only
 * construct, the two strings stop matching and this fails.
 *
 * It needs no database server.
 */

// Every statement the migration issues, as a function of a knex instance.
const statements = (k: Knex): string[] => [
	k('rules')
		.where({ type: 'assert' })
		.select('id', 'tenantId', 'name', 'negate', 'method', 'value')
		.toString(),
	k('rules')
		.where({ type: 'assert' })
		.andWhere('negate', true)
		.update({ type: 'allow', negate: false })
		.toString(),
	k('rules')
		.where({ type: 'assert' })
		.andWhere((b: Knex.QueryBuilder) => b.where('negate', false).orWhereNull('negate'))
		.update({ type: 'block' })
		.toString(),
	k('rules')
		.where({ type: 'gain' })
		.andWhere('negate', true)
		.select('id', 'tenantId', 'name', 'action')
		.toString(),
	k('rules')
		.where({ type: 'allow' })
		.update({ type: 'assert', negate: true })
		.toString(),
	k('rules')
		.where({ type: 'block' })
		.update({ type: 'assert', negate: false })
		.toString()
];

// Postgres quotes identifiers with ", MySQL with `. Fold both to the same token so
// only real dialect differences remain.
const unquote = (sql: string): string => sql.replace(/["`]/g, '~');

describe('rules migration runs on Postgres and MySQL', () => {
	const pg = statements(knexLib({ client: 'pg' }));
	const mysql = statements(knexLib({ client: 'mysql2' }));

	it('issues the same statements on both dialects, bar identifier quoting', () => {
		assert.strictEqual(pg.length, mysql.length);

		for (let i = 0; i < pg.length; i++) {
			assert.strictEqual(unquote(mysql[i]), unquote(pg[i]), `statement ${i + 1} is not portable`);
		}
	});

	it('spells out the null case, which MySQL needs for an unset tinyint', () => {
		// `negate` is nullable and MySQL stores it as tinyint(1); a row that never had
		// the flag set must still be converted, so `is null` cannot be dropped.
		assert.ok(mysql.some((s) => s.includes('is null')), 'no statement handles a null negate');
	});

	it('uses no Postgres-only syntax', () => {
		const forbidden = [ 'ilike', '::', '->>', 'returning', 'on conflict' ];

		for (const sql of pg) {
			for (const token of forbidden) {
				assert.ok(!sql.toLowerCase().includes(token), `"${token}" will not run on MySQL: ${sql}`);
			}
		}
	});
});
