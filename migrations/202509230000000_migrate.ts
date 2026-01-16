import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
    await knex.schema.createTable('defaults', (table) => {
		table.bigIncrements('id');
		table.bigint('tenantId').unsigned().references('id').inTable('tenants').onDelete('CASCADE');
		table.bigint('numberLimit').unsigned();
        table.bigint('liveNumberLimit').unsigned();
        table.bigint('userManagedRoomNumberLimit').unsigned();
        table.bigint('managerManagedRoomNumberLimit').unsigned();

        table.boolean('lockedManaged');
        table.boolean('raiseHandEnabledManaged');
        table.boolean('localRecordingEnabledManaged');
        
        table.boolean('lockedUnmanaged');
        table.boolean('raiseHandEnabledUnmanaged');
        table.boolean('localRecordingEnabledUnmanaged');
        
        table.boolean('lockedLock');
        table.boolean('raiseHandEnabledLock');
        table.boolean('localRecordingEnabledLock');

        table.boolean('chatEnabledManaged');
        table.boolean('breakoutsEnabledManaged');
		table.boolean('filesharingEnabledManaged');
		
        table.boolean('chatEnabledUnmanaged');
        table.boolean('breakoutsEnabledUnmanaged');
		table.boolean('filesharingEnabledUnmanaged');
		
        table.boolean('chatEnabledLock');
        table.boolean('breakoutsEnabledLock');
		table.boolean('filesharingEnabledLock');
        
        table.string('tracker');
        table.bigint('maxFileSize').unsigned();
        table.string('background');
        table.string('logo');
        
        table.bigint('defaultRoleId').unsigned().references('id').inTable('roles');
        table.bigint('tenantPermissionLimitRole').unsigned().references('id').inTable('roles');

	});
}
export async function down(knex: Knex): Promise<void> {

}