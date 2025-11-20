import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {

	const columnsToDrop = [
		'lockedManaged',
		'raiseHandEnabledManaged',
		'localRecordingEnabledManaged',
		'chatEnabledManaged',
		'breakoutsEnabledManaged',
		'filesharingEnabledManaged',
		'tenantPermissionLimitRole'
	];

	await knex.schema.alterTable('defaults', (table) => {
		columnsToDrop.forEach(async column => {
			let deleteable = await knex.schema.hasColumn('defaults', column);
			if (deleteable) {
				table.dropColumn(column);
			}
		});
	});
}
export async function down(knex: Knex): Promise<void> {

}