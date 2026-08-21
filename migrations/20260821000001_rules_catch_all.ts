import { Knex } from 'knex';

/**
 * Give every existing allow list an explicit default.
 *
 * An allow list used to restrict a tenant implicitly: the mere existence of an
 * allow rule meant everyone unmatched was refused. That was invisible, and adding
 * a single allow rule as an exception silently shut the whole tenant. The default
 * is now stated as an ordinary rule, `Block` with the `anyone` comparison, which
 * matches everybody but ranks below every real rule so it only decides for people
 * no other rule mentions.
 *
 * So any tenant that already has an allow rule needs that row, or its allow list
 * would stop restricting on upgrade and let everyone in. Nothing is edited or
 * removed here, only added.
 *
 * Runs after 20260821000000_rules_block_allow, which is what produces the `allow`
 * rows this looks for. Data only, no schema change.
 */
export async function up(knex: Knex): Promise<void> {
	const withAllow = await knex('rules').where({ type: 'allow' }).distinct('tenantId');
	const withCatchAll = await knex('rules').where({ method: 'anyone' }).distinct('tenantId');
	const alreadyHas = new Set(withCatchAll.map((r) => String(r.tenantId)));

	const needed = withAllow
		.map((r) => r.tenantId)
		.filter((tenantId) => tenantId != null && !alreadyHas.has(String(tenantId)));

	for (const tenantId of needed) {
		await knex('rules').insert({
			tenantId,
			name: 'everyone else',
			type: 'block',
			method: 'anyone',
			parameter: '',
			value: '',
			action: '',
			accessId: '',
			negate: false
		});

		// eslint-disable-next-line no-console
		console.log(
			`[rules migration] tenant ${tenantId} has an allow list, added "Block anyone" so it keeps restricting`
		);
	}

	// eslint-disable-next-line no-console
	console.log(`[rules migration] added ${needed.length} catch-all rule(s)`);
}

export async function down(knex: Knex): Promise<void> {
	await knex('rules').where({ type: 'block', method: 'anyone' }).delete();
}
