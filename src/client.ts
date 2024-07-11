// For more information about this file see https://dove.feathersjs.com/guides/cli/client.html
import { feathers } from '@feathersjs/feathers'
import type { TransportConnection, Application } from '@feathersjs/feathers'
import authenticationClient from '@feathersjs/authentication-client'
import type { AuthenticationClientOptions } from '@feathersjs/authentication-client'

import { roomSettingsClient } from './services/roomSettings/roomSettings.shared'
export type {
  RoomSettings,
  RoomSettingsData,
  RoomSettingsQuery,
  RoomSettingsPatch
} from './services/roomSettings/roomSettings.shared'

import { mediaNodesClient } from './services/mediaNodes/mediaNodes.shared'
export type {
  MediaNodes,
  MediaNodesData,
  MediaNodesQuery,
  MediaNodesPatch
} from './services/mediaNodes/mediaNodes.shared'

import { mediaNodesClient } from './services/mediaNodes/mediaNodes.shared'
export type {
  MediaNodes,
  MediaNodesData,
  MediaNodesQuery,
  MediaNodesPatch
} from './services/mediaNodes/mediaNodes.shared'

import { tenantClient } from './services/tenants/tenants.shared'
export type { Tenant, TenantData, TenantQuery, TenantPatch } from './services/tenants/tenants.shared'

import { tenantOwnerClient } from './services/tenantOwners/tenantOwners.shared'
export type {
  TenantOwner,
  TenantOwnerData,
  TenantOwnerQuery,
  TenantOwnerPatch
} from './services/tenantOwners/tenantOwners.shared'

import { tenantOAuthClient } from './services/tenantOAuths/tenantOAuths.shared'
export type {
  TenantOAuth,
  TenantOAuthData,
  TenantOAuthQuery,
  TenantOAuthPatch
} from './services/tenantOAuths/tenantOAuths.shared'

import { tenantFqdnClient } from './services/tenantFQDNs/tenantFQDNs.shared'
export type {
  TenantFqdn,
  TenantFqdnData,
  TenantFqdnQuery,
  TenantFqdnPatch
} from './services/tenantFQDNs/tenantFQDNs.shared'

import { tenantAdminClient } from './services/tenantAdmins/tenantAdmins.shared'
export type {
  TenantAdmin,
  TenantAdminData,
  TenantAdminQuery,
  TenantAdminPatch
} from './services/tenantAdmins/tenantAdmins.shared'

import { roomUserRoleClient } from './services/roomUserRoles/roomUserRoles.shared'
export type {
  RoomUserRole,
  RoomUserRoleData,
  RoomUserRoleQuery,
  RoomUserRolePatch
} from './services/roomUserRoles/roomUserRoles.shared'

import { roomClient } from './services/rooms/rooms.shared'
export type { Room, RoomData, RoomQuery, RoomPatch } from './services/rooms/rooms.shared'

import { roomOwnerClient } from './services/roomOwners/roomOwners.shared'
export type {
  RoomOwner,
  RoomOwnerData,
  RoomOwnerQuery,
  RoomOwnerPatch
} from './services/roomOwners/roomOwners.shared'

import { roomGroupRoleClient } from './services/roomGroupRoles/roomGroupRoles.shared'
export type {
  RoomGroupRole,
  RoomGroupRoleData,
  RoomGroupRoleQuery,
  RoomGroupRolePatch
} from './services/roomGroupRoles/roomGroupRoles.shared'

import { roleClient } from './services/roles/roles.shared'
export type { Role, RoleData, RoleQuery, RolePatch } from './services/roles/roles.shared'

import { rolePermissionClient } from './services/rolePermissions/rolePermissions.shared'
export type {
  RolePermission,
  RolePermissionData,
  RolePermissionQuery,
  RolePermissionPatch
} from './services/rolePermissions/rolePermissions.shared'

import { permissionClient } from './services/permissions/permissions.shared'
export type {
  Permission,
  PermissionData,
  PermissionQuery,
  PermissionPatch
} from './services/permissions/permissions.shared'

import { groupUserClient } from './services/groupUsers/groupUsers.shared'
export type {
  GroupUser,
  GroupUserData,
  GroupUserQuery,
  GroupUserPatch
} from './services/groupUsers/groupUsers.shared'

import { groupClient } from './services/groups/groups.shared'
export type { Group, GroupData, GroupQuery, GroupPatch } from './services/groups/groups.shared'

import { userClient } from './services/users/users.shared'
export type { User, UserData, UserQuery, UserPatch } from './services/users/users.shared'

export interface Configuration {
  connection: TransportConnection<ServiceTypes>
}

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface ServiceTypes {}

export type ClientApplication = Application<ServiceTypes, Configuration>

/**
 * Returns a typed client for the edumeet-tmp app.
 *
 * @param connection The REST or Socket.io Feathers client connection
 * @param authenticationOptions Additional settings for the authentication client
 * @see https://dove.feathersjs.com/api/client.html
 * @returns The Feathers client application
 */
// eslint-disable-next-line no-unused-vars, no-shadow
export const createClient = <Configuration = any,>(
  connection: TransportConnection<ServiceTypes>,
  authenticationOptions: Partial<AuthenticationClientOptions> = {}
) => {
  const client: ClientApplication = feathers()

  client.configure(connection)
  client.configure(authenticationClient(authenticationOptions))
  client.set('connection', connection)

  client.configure(userClient)
  client.configure(groupClient)
  client.configure(groupUserClient)
  client.configure(permissionClient)
  client.configure(rolePermissionClient)
  client.configure(roleClient)
  client.configure(roomGroupRoleClient)
  client.configure(roomOwnerClient)
  client.configure(roomClient)
  client.configure(roomUserRoleClient)
  client.configure(tenantAdminClient)
  client.configure(tenantFqdnClient)
  client.configure(tenantOAuthClient)
  client.configure(tenantOwnerClient)
  client.configure(tenantClient)

  client.configure(mediaNodesClient)
  client.configure(mediaNodesClient)
  client.configure(roomSettingsClient)
  return client
}
