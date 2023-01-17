// For more information about this file see https://dove.feathersjs.com/guides/cli/client.html
import { feathers } from '@feathersjs/feathers'
import type { TransportConnection, Params } from '@feathersjs/feathers'
import authenticationClient from '@feathersjs/authentication-client'
import type { AuthenticationClientOptions } from '@feathersjs/authentication-client'
import type { Location, LocationData, LocationQuery, LocationService } from './services/locations/locations'
export type { Location, LocationData, LocationQuery }
export const locationServiceMethods = ['find', 'get', 'create', 'patch', 'remove'] as const
export type LocationClientService = Pick<
  LocationService<Params<LocationQuery>>,
  (typeof locationServiceMethods)[number]
>

import type {
  MediaNode,
  MediaNodeData,
  MediaNodeQuery,
  MediaNodeService
} from './services/mediaNodes/mediaNodes'
export type { MediaNode, MediaNodeData, MediaNodeQuery }
export const mediaNodeServiceMethods = ['find', 'get', 'create', 'patch', 'remove'] as const
export type MediaNodeClientService = Pick<
  MediaNodeService<Params<MediaNodeQuery>>,
  (typeof mediaNodeServiceMethods)[number]
>

import type { CoHost, CoHostData, CoHostQuery, CoHostService } from './services/coHosts/coHosts'
export type { CoHost, CoHostData, CoHostQuery }
export const coHostServiceMethods = ['find', 'get', 'create', 'patch', 'remove'] as const
export type CoHostClientService = Pick<
  CoHostService<Params<CoHostQuery>>,
  (typeof coHostServiceMethods)[number]
>

import type {
  OrganizationAdmin,
  OrganizationAdminData,
  OrganizationAdminQuery,
  OrganizationAdminService
} from './services/organizationAdmins/organizationAdmins'
export type { OrganizationAdmin, OrganizationAdminData, OrganizationAdminQuery }
export const organizationAdminServiceMethods = ['find', 'get', 'create', 'patch', 'remove'] as const
export type OrganizationAdminClientService = Pick<
  OrganizationAdminService<Params<OrganizationAdminQuery>>,
  (typeof organizationAdminServiceMethods)[number]
>

import type {
  Organization,
  OrganizationData,
  OrganizationQuery,
  OrganizationService
} from './services/organizations/organizations'
export type { Organization, OrganizationData, OrganizationQuery }
export const organizationServiceMethods = ['find', 'get', 'create', 'patch', 'remove'] as const
export type OrganizationClientService = Pick<
  OrganizationService<Params<OrganizationQuery>>,
  (typeof organizationServiceMethods)[number]
>

import type { Room, RoomData, RoomQuery, RoomService } from './services/rooms/rooms'
export type { Room, RoomData, RoomQuery }
export const roomServiceMethods = ['find', 'get', 'create', 'patch', 'remove'] as const
export type RoomClientService = Pick<RoomService<Params<RoomQuery>>, (typeof roomServiceMethods)[number]>

import type { User, UserData, UserQuery, UserService } from './services/users/users'
export type { User, UserData, UserQuery }
export const userServiceMethods = ['find', 'get', 'create', 'patch', 'remove'] as const
export type UserClientService = Pick<UserService<Params<UserQuery>>, (typeof userServiceMethods)[number]>

export interface ServiceTypes {
  locations: LocationClientService
  mediaNodes: MediaNodeClientService
  coHosts: CoHostClientService
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
  const client = feathers<ServiceTypes, Configuration>()

  client.configure(connection)
  client.configure(authenticationClient(authenticationOptions))

  client.use('users', connection.service('users'), {
    methods: userServiceMethods
  })

  client.use('rooms', connection.service('rooms'), {
    methods: roomServiceMethods
  })
  client.use('organizations', connection.service('organizations'), {
    methods: organizationServiceMethods
  })
  client.use('organizationAdmins', connection.service('organizationAdmins'), {
    methods: organizationAdminServiceMethods
  })

  client.use('coHosts', connection.service('coHosts'), {
    methods: coHostServiceMethods
  })

  client.use('mediaNodes', connection.service('mediaNodes'), {
    methods: mediaNodeServiceMethods
  })
  client.use('locations', connection.service('locations'), {
    methods: locationServiceMethods
  })
  return client
}
