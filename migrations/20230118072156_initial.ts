import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
	await knex.schema.createTable('tenants', (table) => {
		table.increments('id');
		table.string('name');
		table.string('description');
	});

	await knex.schema.createTable('users', (table) => {
		table.increments('id');
		table.string('ssoId');
		table.bigint('tenantId').references('id').inTable('tenants').onDelete('CASCADE');
		table.string('email');
		table.string('password');
		table.string('name');
		table.string('avatar');
		table.unique([ 'tenantId', 'email' ], { useConstraint: true });
		table.unique([ 'tenantId', 'ssoId' ], { useConstraint: true });
	});

	await knex.schema.createTable('groups', (table) => {
		table.increments('id');
		table.string('name');
		table.string('description');
		table.bigint('tenantId').references('id').inTable('tenants').onDelete('CASCADE');
	});

	await knex.schema.createTable('groupUsers', (table) => {
		table.increments('id');
		table.bigint('groupId').references('id').inTable('groups').onDelete('CASCADE');
		table.bigint('userId').references('id').inTable('users').onDelete('CASCADE');
		table.unique([ 'groupId', 'userId' ], { useConstraint: true });
	});

	await knex.schema.createTable('tenantOwners', (table) => {
		table.increments('id');
		table.bigint('tenantId').references('id').inTable('tenants').onDelete('CASCADE');
		table.bigint('userId').references('id').inTable('users').onDelete('CASCADE');
		table.unique([ 'tenantId', 'userId' ], { useConstraint: true });
	});

	await knex.schema.createTable('tenantAdmins', (table) => {
		table.increments('id');
		table.bigint('tenantId').references('id').inTable('tenants').onDelete('CASCADE');
		table.bigint('userId').references('id').inTable('users').onDelete('CASCADE');
		table.unique([ 'tenantId', 'userId' ], { useConstraint: true });
	});

	await knex.schema.createTable('tenantFDQNs', (table) => {
		table.increments('id');
		table.bigint('tenantId').references('id').inTable('tenants').onDelete('CASCADE');
		table.string('fqdn');
		table.string('description');
		table.unique([ 'tenantId', 'fqdn' ], { useConstraint: true });
	});

	await knex.schema.createTable('tenantOAuths', (table) => {
		table.increments('id');
		table.bigint('tenantId').references('id').inTable('tenants').onDelete('CASCADE');
		table.string('key');
		table.string('secret');
		table.string('authorize_url');
		table.string('access_url');
		table.string('profile_url');
		table.string('scope');
		table.string('scope_delimiter');
		table.unique([ 'tenantId' ], { useConstraint: true });
	});

	await knex.schema.createTable('roles', (table) => {
		table.increments('id');
		table.string('name');
		table.string('description');
		table.bigint('tenantId').references('id').inTable('tenants').onDelete('CASCADE');
	});

	await knex.schema.createTable('permissions', (table) => {
		table.increments('id');
		table.string('name');
		table.string('description');
	});

	// These are the default permissions
	await knex.insert([
		{ name: 'BYPASS_ROOM_LOCK', description: 'Permission to bypass a room lock' },
		{ name: 'BYPASS_LOBBY', description: 'Permission to bypass the lobby' },
		{ name: 'CHANGE_ROOM_LOCK', description: 'Permission to lock/unlock a room' },
		{ name: 'PROMOTE_PEER', description: 'Permission to promote a peer from the lobby' },
		{ name: 'MODIFY_ROLE', description: 'Permission to modify the role of a peer' },
		{ name: 'SEND_CHAT', description: 'Permission to send chat messages' },
		{ name: 'MODERATE_CHAT', description: 'Permission to moderate chat messages' },
		{ name: 'SHARE_AUDIO', description: 'Permission to share audio' },
		{ name: 'SHARE_VIDEO', description: 'Permission to share video' },
		{ name: 'SHARE_SCREEN', description: 'Permission to share screen' },
		{ name: 'SHARE_EXTRA_VIDEO', description: 'Permission to share extra video' },
		{ name: 'SHARE_FILE', description: 'Permission to share files' },
		{ name: 'MODERATE_FILES', description: 'Permission to moderate files' },
		{ name: 'MODERATE_ROOM', description: 'Permission to moderate the room (e.g. kick user)' },
		{ name: 'LOCAL_RECORD_ROOM', description: 'Permission to record the room locally' },
		{ name: 'CREATE_ROOM', description: 'Permission to create a room' },
		{ name: 'CHANGE_ROOM', description: 'Permission move between rooms' },
	]).into('permissions');

	await knex.schema.createTable('rolePermissions', (table) => {
		table.increments('id');
		table.bigint('roleId').references('id').inTable('roles').onDelete('CASCADE');
		table.bigint('permissionId').references('id').inTable('permissions').onDelete('CASCADE');
		table.unique([ 'roleId', 'permissionId' ], { useConstraint: true });
	});

	await knex.schema.createTable('rooms', (table) => {
		table.increments('id');
		table.string('name');
		table.string('description');
		table.bigint('createdAt');
		table.bigint('updatedAt');
		table.bigint('creatorId').references('id').inTable('users');
		table.bigint('tenantId').references('id').inTable('tenants').onDelete('CASCADE');
		table.string('logo');
		table.string('background');
		table.integer('maxActiveVideos');
		table.boolean('locked');
		table.boolean('breakoutsEnabled');
		table.boolean('chatEnabled');
		table.boolean('raiseHandEnabled');
		table.boolean('filesharingEnabled');
		table.boolean('localRecordingEnabled');
		table.unique([ 'tenantId', 'name' ], { useConstraint: true });
	});

	await knex.schema.createTable('roomOwners', (table) => {
		table.increments('id');
		table.bigint('roomId').references('id').inTable('rooms').onDelete('CASCADE');
		table.bigint('userId').references('id').inTable('users').onDelete('CASCADE');
		table.unique([ 'roomId', 'userId' ], { useConstraint: true });
	});

	await knex.schema.createTable('roomGroupRoles', (table) => {
		table.increments('id');
		table.bigint('roomId').references('id').inTable('rooms').onDelete('CASCADE');
		table.bigint('groupId').references('id').inTable('groups').onDelete('CASCADE');
		table.bigint('roleId').references('id').inTable('roles').onDelete('CASCADE');
		table.unique([ 'roomId', 'groupId', 'roleId' ], { useConstraint: true });
	});

	await knex.schema.createTable('roomUserRoles', (table) => {
		table.increments('id');
		table.bigint('roomId').references('id').inTable('rooms').onDelete('CASCADE');
		table.bigint('userId').references('id').inTable('users').onDelete('CASCADE');
		table.bigint('roleId').references('id').inTable('roles').onDelete('CASCADE');
		table.unique([ 'roomId', 'userId', 'roleId' ], { useConstraint: true });
	});

	await knex.schema.createTable('locations', (table) => {
		table.increments('id');
		table.string('name');
		table.string('description');
		table.float('latitude');
		table.float('longitude');
	});

	await knex.schema.createTable('recorders', (table) => {
		table.increments('id');
		table.bigint('createdAt');
		table.bigint('updatedAt');
		table.string('hostname');
		table.integer('port');
		table.string('secret');
		table.bigint('locationId').references('id').inTable('locations').onDelete('CASCADE');
	});

	await knex.schema.createTable('trackers', (table) => {
		table.increments('id');
		table.bigint('createdAt');
		table.bigint('updatedAt');
		table.string('hostname');
		table.integer('port');
		table.string('secret');
		table.bigint('locationId').references('id').inTable('locations').onDelete('CASCADE');
	});

	await knex.schema.createTable('mediaNodes', (table) => {
		table.increments('id');
		table.bigint('createdAt');
		table.bigint('updatedAt');
		table.string('hostname');
		table.integer('port');
		table.string('secret');
		table.bigint('locationId').references('id').inTable('locations').onDelete('CASCADE');
	});
}

export async function down(knex: Knex): Promise<void> {
	await knex.schema.dropTable('users');
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
	await knex.schema.dropTable('mediaNodes');
}