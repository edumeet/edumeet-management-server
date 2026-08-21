import { Knex } from 'knex';

/**
 * Split the old `assert` rule type into `block` and `allow`.
 *
 * Previously one type carried both meanings and `negate` decided which: the rule
 * always refused whoever its condition matched, so negate off refused the people
 * who matched (a block list) and negate on refused everyone who did not (an allow
 * list). Two allow-list rules therefore AND-ed together and blocked everybody.
 *
 * Data only, no schema change.
 */
export async function up(knex: Knex): Promise<void> {
	// Print what is about to change, so the conversion is auditable rather than
	// silent. This rewrites who may sign in, so it is worth seeing in the logs.
	const before = await knex('rules').where({ type: 'assert' })
		.select('id', 'tenantId', 'name', 'negate', 'method', 'value');

	for (const rule of before) {
		// Postgres returns a boolean here, MySQL a tinyint(1) as 0/1. Normalise so the
		// audit line reads the same whichever database this is running against.
		const negated = Boolean(rule.negate);

		// eslint-disable-next-line no-console
		console.log(
			`[rules migration] tenant ${rule.tenantId} rule ${rule.id} "${rule.name}" ` +
			`(${rule.method} ${rule.value}, negate=${negated}) -> ${negated ? 'allow' : 'block'}`
		);
	}

	// negate on: only those matching were admitted, i.e. an allow list. The
	// condition already describes who may sign in, so it is kept as written and the
	// inversion is dropped - direction is now carried by the type.
	await knex('rules')
		.where({ type: 'assert' })
		.andWhere('negate', true)
		.update({ type: 'allow', negate: false });

	// negate off or never set: matching the condition is what refused you, i.e. a
	// block list. `negate` is nullable, and mysql2 returns tinyint(1) as 0/1, so
	// the null case has to be spelled out.
	await knex('rules')
		.where({ type: 'assert' })
		.andWhere((builder) => builder.where('negate', false).orWhereNull('negate'))
		.update({ type: 'block' });

	// eslint-disable-next-line no-console
	console.log(`[rules migration] converted ${before.length} access rule(s)`);

	// Access rules no longer use `negate` after the conversion above: the direction
	// is carried by block/allow. Grant rules keep it, because "grant to everyone
	// except X" has no other spelling, so the column stays. Report any that use it,
	// since the dialog no longer offers negated conditions and an admin editing such
	// a rule should know why it looks different from the others.
	const negatedGrants = await knex('rules').where({ type: 'gain' }).andWhere('negate', true)
		.select('id', 'tenantId', 'name', 'action');

	for (const rule of negatedGrants) {
		// eslint-disable-next-line no-console
		console.log(
			`[rules migration] NOTE tenant ${rule.tenantId} grant rule ${rule.id} "${rule.name}" ` +
			`(${rule.action}) grants on a negated condition; it keeps working and is shown as such`
		);
	}
}

export async function down(knex: Knex): Promise<void> {
	await knex('rules').where({ type: 'allow' }).update({ type: 'assert', negate: true });
	await knex('rules').where({ type: 'block' }).update({ type: 'assert', negate: false });
}
