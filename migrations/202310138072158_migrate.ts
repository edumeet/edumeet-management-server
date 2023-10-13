import { Knex } from 'knex';
export async function up(knex: Knex): Promise<void> {
	/*
	EXAMPLE UPDATE/migration file 
	 await knex.schema.alterTable('rooms', (table) => {
		table.bigint('defaultRoleId').references('id').inTable('roles');
		table.string('videoCodec');
		table.boolean('simulcast');
		table.string('videoResolution');
		table.integer('videoFramerate');
		table.string('audioCodec');
		table.boolean('autoGainControl');
		table.boolean('echoCancellation');
		table.boolean('noiseSuppression');
		table.integer('sampleRate');
		table.integer('channelCount');
		table.integer('sampleSize');
		table.boolean('opusStereo');
		table.boolean('opusDtx');
		table.boolean('opusFec');
		table.integer('opusPtime');
		table.integer('opusMaxPlaybackRate');
		table.string('screenSharingCodec');
		table.boolean('screenSharingSimulcast');
		table.string('screenSharingResolution');
		table.integer('screenSharingFramerate');
	}); */
}
export async function down(knex: Knex): Promise<void> {
	/* await knex.schema.dropTable('users');
	await knex.schema.dropTable('groups');
	await knex.schema.dropTable('groupUsers');
	await knex.schema.dropTable('tenants');
	await knex.schema.dropTable('tenantOwners');
	await knex.schema.dropTable('tenantAdmins');
	await knex.schema.dropTable('tenantFQDNs');
	await knex.schema.dropTable('tenantOAuths');
	await knex.schema.dropTable('roles');
	await knex.schema.dropTable('permissions');
	await knex.schema.dropTable('rolePermissions');
	await knex.schema.dropTable('rooms');
	await knex.schema.dropTable('roomOwners');
	await knex.schema.dropTable('roomGroupRoles');
	await knex.schema.dropTable('roomUserRoles');
	await knex.schema.dropTable('recorders');
	await knex.schema.dropTable('trackers');
	await knex.schema.dropTable('locations');
	await knex.schema.dropTable('mediaNodes'); */
}