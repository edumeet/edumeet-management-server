import { roomOwner } from './roomOwners/roomOwners';
import { groupUser } from './groupUsers/groupUsers';
import { tenantOwner } from './tenantOwners/tenantOwners';
import { rolePermission } from './rolePermissions/rolePermissions';
import { roomGroupRole } from './roomGroupRoles/roomGroupRoles';
import { roomUserRole } from './roomUserRoles/roomUserRoles';
import { recorder } from './recorders/recorders';
import { tracker } from './trackers/trackers';
import { permission } from './permissions/permissions';
import { role } from './roles/roles';
import { group } from './groups/groups';
import { tenantFqdn } from './tenantFQDNs/tenantFQDNs';
import { location } from './locations/locations';
import { mediaNode } from './mediaNodes/mediaNodes';
import { tenantAdmin } from './tenantAdmins/tenantAdmins';
import { tenant } from './tenants/tenants';
import { room } from './rooms/rooms';
import { user } from './users/users';
// For more information about this file see https://dove.feathersjs.com/guides/cli/application.html#configure-functions
import type { Application } from '../declarations';

export const services = (app: Application) => {
	app.configure(roomOwner);
	app.configure(groupUser);
	app.configure(tenantOwner);
	app.configure(rolePermission);
	app.configure(roomGroupRole);
	app.configure(roomUserRole);
	app.configure(recorder);
	app.configure(tracker);
	app.configure(permission);
	app.configure(role);
	app.configure(group);
	app.configure(tenantFqdn);
	app.configure(location);
	app.configure(mediaNode);
	app.configure(tenantAdmin);
	app.configure(tenant);
	app.configure(room);
	app.configure(user);
	// All services will be registered here
};
