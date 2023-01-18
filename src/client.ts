// For more information about this file see https://dove.feathersjs.com/guides/cli/client.html
import { feathers } from '@feathersjs/feathers';
import type { TransportConnection, Params } from '@feathersjs/feathers';
import authenticationClient from '@feathersjs/authentication-client';
import type { AuthenticationClientOptions } from '@feathersjs/authentication-client';
import type {
	GroupUser,
	GroupUserData,
	GroupUserQuery,
	GroupUserService
} from './services/groupUsers/groupUsers';
export type { GroupUser, GroupUserData, GroupUserQuery };
export const groupUserServiceMethods = [ 'find', 'get', 'create', 'patch', 'remove' ] as const;
export type GroupUserClientService = Pick<
	GroupUserService<Params<GroupUserQuery>>,
	(typeof groupUserServiceMethods)[number]
>

import type {
	OrganizationOwner,
	OrganizationOwnerData,
	OrganizationOwnerQuery,
	OrganizationOwnerService
} from './services/organizationOwners/organizationOwners';
export type { OrganizationOwner, OrganizationOwnerData, OrganizationOwnerQuery };
export const organizationOwnerServiceMethods = [ 'find', 'get', 'create', 'patch', 'remove' ] as const;
export type OrganizationOwnerClientService = Pick<
	OrganizationOwnerService<Params<OrganizationOwnerQuery>>,
	(typeof organizationOwnerServiceMethods)[number]
>

import type {
	RolePermission,
	RolePermissionData,
	RolePermissionQuery,
	RolePermissionService
} from './services/rolePermissions/rolePermissions';
export type { RolePermission, RolePermissionData, RolePermissionQuery };
export const rolePermissionServiceMethods = [ 'find', 'get', 'create', 'patch', 'remove' ] as const;
export type RolePermissionClientService = Pick<
	RolePermissionService<Params<RolePermissionQuery>>,
	(typeof rolePermissionServiceMethods)[number]
>

import type {
	RoomGroupRole,
	RoomGroupRoleData,
	RoomGroupRoleQuery,
	RoomGroupRoleService
} from './services/roomGroupRoles/roomGroupRoles';
export type { RoomGroupRole, RoomGroupRoleData, RoomGroupRoleQuery };
export const roomGroupRoleServiceMethods = [ 'find', 'get', 'create', 'patch', 'remove' ] as const;
export type RoomGroupRoleClientService = Pick<
	RoomGroupRoleService<Params<RoomGroupRoleQuery>>,
	(typeof roomGroupRoleServiceMethods)[number]
>

import type {
	RoomUserRole,
	RoomUserRoleData,
	RoomUserRoleQuery,
	RoomUserRoleService
} from './services/roomUserRoles/roomUserRoles';
export type { RoomUserRole, RoomUserRoleData, RoomUserRoleQuery };
export const roomUserRoleServiceMethods = [ 'find', 'get', 'create', 'patch', 'remove' ] as const;
export type RoomUserRoleClientService = Pick<
	RoomUserRoleService<Params<RoomUserRoleQuery>>,
	(typeof roomUserRoleServiceMethods)[number]
>

import type { Recorder, RecorderData, RecorderQuery, RecorderService } from './services/recorders/recorders';
export type { Recorder, RecorderData, RecorderQuery };
export const recorderServiceMethods = [ 'find', 'get', 'create', 'patch', 'remove' ] as const;
export type RecorderClientService = Pick<
	RecorderService<Params<RecorderQuery>>,
	(typeof recorderServiceMethods)[number]
>

import type { Tracker, TrackerData, TrackerQuery, TrackerService } from './services/trackers/trackers';
export type { Tracker, TrackerData, TrackerQuery };
export const trackerServiceMethods = [ 'find', 'get', 'create', 'patch', 'remove' ] as const;
export type TrackerClientService = Pick<
	TrackerService<Params<TrackerQuery>>,
	(typeof trackerServiceMethods)[number]
>

import type {
	Permission,
	PermissionData,
	PermissionQuery,
	PermissionService
} from './services/permissions/permissions';
export type { Permission, PermissionData, PermissionQuery };
export const permissionServiceMethods = [ 'find', 'get', 'create', 'patch', 'remove' ] as const;
export type PermissionClientService = Pick<
	PermissionService<Params<PermissionQuery>>,
	(typeof permissionServiceMethods)[number]
>

import type { Role, RoleData, RoleQuery, RoleService } from './services/roles/roles';
export type { Role, RoleData, RoleQuery };
export const roleServiceMethods = [ 'find', 'get', 'create', 'patch', 'remove' ] as const;
export type RoleClientService = Pick<RoleService<Params<RoleQuery>>, (typeof roleServiceMethods)[number]>

import type { Group, GroupData, GroupQuery, GroupService } from './services/groups/groups';
export type { Group, GroupData, GroupQuery };
export const groupServiceMethods = [ 'find', 'get', 'create', 'patch', 'remove' ] as const;
export type GroupClientService = Pick<GroupService<Params<GroupQuery>>, (typeof groupServiceMethods)[number]>

import type {
	OrganizationFqdn,
	OrganizationFqdnData,
	OrganizationFqdnQuery,
	OrganizationFqdnService
} from './services/organizationFQDNs/organizationFQDNs';
export type { OrganizationFqdn, OrganizationFqdnData, OrganizationFqdnQuery };
export const organizationFqdnServiceMethods = [ 'find', 'get', 'create', 'patch', 'remove' ] as const;
export type OrganizationFqdnClientService = Pick<
	OrganizationFqdnService<Params<OrganizationFqdnQuery>>,
	(typeof organizationFqdnServiceMethods)[number]
>

import type { Location, LocationData, LocationQuery, LocationService } from './services/locations/locations';
export type { Location, LocationData, LocationQuery };
export const locationServiceMethods = [ 'find', 'get', 'create', 'patch', 'remove' ] as const;
export type LocationClientService = Pick<
	LocationService<Params<LocationQuery>>,
	(typeof locationServiceMethods)[number]
>

import type {
	MediaNode,
	MediaNodeData,
	MediaNodeQuery,
	MediaNodeService
} from './services/mediaNodes/mediaNodes';
export type { MediaNode, MediaNodeData, MediaNodeQuery };
export const mediaNodeServiceMethods = [ 'find', 'get', 'create', 'patch', 'remove' ] as const;
export type MediaNodeClientService = Pick<
	MediaNodeService<Params<MediaNodeQuery>>,
	(typeof mediaNodeServiceMethods)[number]
>

import type {
	OrganizationAdmin,
	OrganizationAdminData,
	OrganizationAdminQuery,
	OrganizationAdminService
} from './services/organizationAdmins/organizationAdmins';
export type { OrganizationAdmin, OrganizationAdminData, OrganizationAdminQuery };
export const organizationAdminServiceMethods = [ 'find', 'get', 'create', 'patch', 'remove' ] as const;
export type OrganizationAdminClientService = Pick<
	OrganizationAdminService<Params<OrganizationAdminQuery>>,
	(typeof organizationAdminServiceMethods)[number]
>

import type {
	Organization,
	OrganizationData,
	OrganizationQuery,
	OrganizationService
} from './services/organizations/organizations';
export type { Organization, OrganizationData, OrganizationQuery };
export const organizationServiceMethods = [ 'find', 'get', 'create', 'patch', 'remove' ] as const;
export type OrganizationClientService = Pick<
	OrganizationService<Params<OrganizationQuery>>,
	(typeof organizationServiceMethods)[number]
>

import type { Room, RoomData, RoomQuery, RoomService } from './services/rooms/rooms';
export type { Room, RoomData, RoomQuery };
export const roomServiceMethods = [ 'find', 'get', 'create', 'patch', 'remove' ] as const;
export type RoomClientService = Pick<RoomService<Params<RoomQuery>>, (typeof roomServiceMethods)[number]>

import type { User, UserData, UserQuery, UserService } from './services/users/users';
export type { User, UserData, UserQuery };
export const userServiceMethods = [ 'find', 'get', 'create', 'patch', 'remove' ] as const;
export type UserClientService = Pick<UserService<Params<UserQuery>>, (typeof userServiceMethods)[number]>

export interface ServiceTypes {
	groupUsers: GroupUserClientService
	organizationOwners: OrganizationOwnerClientService
	rolePermissions: RolePermissionClientService
	roomGroupRoles: RoomGroupRoleClientService
	roomUserRoles: RoomUserRoleClientService
	recorders: RecorderClientService
	trackers: TrackerClientService
	permissions: PermissionClientService
	roles: RoleClientService
	groups: GroupClientService
	organizationFQDNs: OrganizationFqdnClientService
	locations: LocationClientService
	mediaNodes: MediaNodeClientService
	organizationAdmins: OrganizationAdminClientService
	organizations: OrganizationClientService
	rooms: RoomClientService
	users: UserClientService
	//
}

/**
 * Returns a typed client for the edumeet-management-server app.
 *
 * @param connection The REST or Socket.io Feathers client connection
 * @param authenticationOptions Additional settings for the authentication client
 * @see https://dove.feathersjs.com/api/client.html
 * @returns The Feathers client application
 */
export const createClient = <Configuration = unknown>(
	connection: TransportConnection<ServiceTypes>,
	authenticationOptions: Partial<AuthenticationClientOptions> = {}
) => {
	const client = feathers<ServiceTypes, Configuration>();

	client.configure(connection);
	client.configure(authenticationClient(authenticationOptions));

	client.use('users', connection.service('users'), {
		methods: userServiceMethods
	});

	client.use('rooms', connection.service('rooms'), {
		methods: roomServiceMethods
	});
	client.use('organizations', connection.service('organizations'), {
		methods: organizationServiceMethods
	});
	client.use('organizationAdmins', connection.service('organizationAdmins'), {
		methods: organizationAdminServiceMethods
	});
	client.use('mediaNodes', connection.service('mediaNodes'), {
		methods: mediaNodeServiceMethods
	});
	client.use('locations', connection.service('locations'), {
		methods: locationServiceMethods
	});

	client.use('organizationFQDNs', connection.service('organizationFQDNs'), {
		methods: organizationFqdnServiceMethods
	});
	client.use('groups', connection.service('groups'), {
		methods: groupServiceMethods
	});
	client.use('roles', connection.service('roles'), {
		methods: roleServiceMethods
	});
	client.use('permissions', connection.service('permissions'), {
		methods: permissionServiceMethods
	});
	client.use('trackers', connection.service('trackers'), {
		methods: trackerServiceMethods
	});
	client.use('recorders', connection.service('recorders'), {
		methods: recorderServiceMethods
	});
	client.use('roomUserRoles', connection.service('roomUserRoles'), {
		methods: roomUserRoleServiceMethods
	});
	client.use('roomGroupRoles', connection.service('roomGroupRoles'), {
		methods: roomGroupRoleServiceMethods
	});
	client.use('rolePermissions', connection.service('rolePermissions'), {
		methods: rolePermissionServiceMethods
	});
	client.use('organizationOwners', connection.service('organizationOwners'), {
		methods: organizationOwnerServiceMethods
	});

	client.use('groupUsers', connection.service('groupUsers'), {
		methods: groupUserServiceMethods
	});
	
	return client;
};
