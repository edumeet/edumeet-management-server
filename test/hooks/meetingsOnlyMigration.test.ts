import assert from 'assert';
import knexLib, { Knex } from 'knex';

import { up } from '../../migrations/20260911000000_add_meetings_only';

const unquote = (sql: string): string => sql.replace(/["`]/g, '~');

const ddl = (k: Knex): Record<string, string> => ({
	addFlag: k.schema.alterTable('rooms', (t) => {
		t.boolean('meetingsOnly').notNullable()
			.defaultTo(false);
	}).toString(),
	addToken: k.schema.alterTable('meetings', (t) => { t.string('meetingToken', 32); }).toString(),
	tighten: k.schema.alterTable('meetings', (t) => {
		t.string('meetingToken', 32).notNullable()
			.alter();
		t.unique([ 'meetingToken' ], { useConstraint: true });
	}).toString(),
	drop: k.schema.alterTable('meetings', (t) => {
		t.dropUnique([ 'meetingToken' ]);
		t.dropColumn('meetingToken');
	}).toString()
});

const dml = (k: Knex): string[] => [
	k('meetings').select('id')
		.toString(),
	k('meetings').where({ id: 1 })
		.update({ meetingToken: 'ABCDEFGHJKLM' })
		.toString()
];

describe('meetings-only migration', () => {
	const pg = knexLib({ client: 'pg' });
	const mysql = knexLib({ client: 'mysql2' });

	it('compiles its schema changes on both dialects', () => {
		for (const [ name, sql ] of Object.entries(ddl(pg))) assert.ok(sql.length > 0, `pg ${name}`);
		for (const [ name, sql ] of Object.entries(ddl(mysql))) assert.ok(sql.length > 0, `mysql ${name}`);
	});

	it('ends with a mandatory, unique token column on both dialects', () => {
		for (const k of [ pg, mysql ]) {
			const sql = ddl(k).tighten.toLowerCase();

			assert.ok(sql.includes('not null'), sql);
			assert.ok(sql.includes('unique'), sql);
		}
	});

	it('issues identical backfill statements on both dialects', () => {
		assert.deepStrictEqual(dml(pg).map(unquote), dml(mysql).map(unquote));
	});

	it('backfills every existing meeting with its own token before making the column mandatory', async () => {
		const log: string[] = [];
		const tokens = new Map<number, string>();
		const ids = [ 1, 2, 3 ];

		const fakeKnex = Object.assign(
			(table: string) => ({
				select: async () => {
					log.push(`select ${table}`);

					return ids.map((id) => ({ id }));
				},
				where: ({ id }: { id: number }) => ({
					update: async ({ meetingToken }: { meetingToken: string }) => {
						log.push(`update ${table} ${id}`);
						tokens.set(id, meetingToken);
					}
				})
			}),
			{
				schema: {
					// eslint-disable-next-line no-unused-vars
					alterTable: async (table: string, cb: (t: unknown) => void) => {
						const calls: string[] = [];
						const builder = (name: string) => (...args: unknown[]) => {
							calls.push(`${name}(${args.map((a) => JSON.stringify(a)).join(',')})`);

							return new Proxy({}, { get: (_t, prop: string) => builder(prop) });
						};

						cb(new Proxy({}, { get: (_t, prop: string) => builder(prop) }));
						log.push(`alter ${table}: ${calls.join(' ')}`);
					}
				}
			}
		);

		await up(fakeKnex as unknown as Knex);

		assert.deepStrictEqual(log, [
			'alter rooms: boolean("meetingsOnly") notNullable() defaultTo(false)',
			'alter meetings: string("meetingToken",32)',
			'select meetings',
			'update meetings 1',
			'update meetings 2',
			'update meetings 3',
			'alter meetings: string("meetingToken",32) notNullable() alter() unique(["meetingToken"],{"useConstraint":true})'
		]);
		assert.strictEqual(new Set(tokens.values()).size, ids.length, 'every row must get its own token');
		for (const t of tokens.values()) assert.match(t, /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{12}$/);
	});
});
