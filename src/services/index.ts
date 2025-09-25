import { tenant } from './tenants/tenants';
import { tenantOwner } from './tenantOwners/tenantOwners';
import { tenantOAuth } from './tenantOAuths/tenantOAuths';
import { tenantFqdn } from './tenantFQDNs/tenantFQDNs';
import { tenantAdmin } from './tenantAdmins/tenantAdmins';
import { roomUserRole } from './roomUserRoles/roomUserRoles';
import { room } from './rooms/rooms';
import { roomOwner } from './roomOwners/roomOwners';
import { roomGroupRole } from './roomGroupRoles/roomGroupRoles';
import { role } from './roles/roles';
import { rolePermission } from './rolePermissions/rolePermissions';
import { permission } from './permissions/permissions';
import { groupUser } from './groupUsers/groupUsers';
import { group } from './groups/groups';
import { user } from './users/users';
// For more information about this file see https://dove.feathersjs.com/guides/cli/application.html#configure-functions
import type { Application } from '../declarations';
import { rule } from './rules/rules';
import { defaults } from './defaults/defaults';

export const services = (app: Application) => {
	app.configure(tenant);
	app.configure(tenantOwner);
	app.configure(tenantOAuth);
	app.configure(tenantFqdn);
	app.configure(tenantAdmin);
	app.configure(roomUserRole);
	app.configure(room);
	app.configure(roomOwner);
	app.configure(roomGroupRole);
	app.configure(role);
	app.configure(rolePermission);
	app.configure(rule);
	app.configure(permission);
	app.configure(groupUser);
	app.configure(defaults);
	app.configure(group);
	app.configure(user);
	// All services will be registered here
};
