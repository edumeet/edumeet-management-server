import { location } from './locations/locations'
import { mediaNode } from './mediaNodes/mediaNodes'
import { coHost } from './coHosts/coHosts'
import { organizationAdmin } from './organizationAdmins/organizationAdmins'
import { organization } from './organizations/organizations'
import { room } from './rooms/rooms'
import { user } from './users/users'
// For more information about this file see https://dove.feathersjs.com/guides/cli/application.html#configure-functions
import type { Application } from '../declarations'

export const services = (app: Application) => {
  app.configure(location)
  app.configure(mediaNode)
  app.configure(coHost)
  app.configure(organizationAdmin)
  app.configure(organization)
  app.configure(room)
  app.configure(user)
  // All services will be registered here
}
