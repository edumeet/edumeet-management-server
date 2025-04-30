import { HookContext } from '../declarations';

export const gainRules = async (context: HookContext): Promise<void> => {
	// ignore tenantid for local admin
	if (context.data?.tenantId) {

		const rulesService = context.app.service('rules');

		const rules = await rulesService.find({
			paginate: false, // Fetch all relevant records
			query: {
				tenantId: parseInt(context.data.tenantId),
				type: 'gain'
			}
		});

		if (rules && rules.length != 0) {
			rules.forEach(async (rule) => {
				const parameter = rule.parameter; // user parameter to check for method (like: email)
				const method = rule.method; // contains, equals, startswith, endswith
				const negate = rule.negate; // true/false  negates method
				const value = rule.value; // int / string that parameter is matched with
				const action = rule.action; // that we want to do user to group,role,...
				const accessId = rule.accessId; // permission ID/name that user can gain (for action)			
				const userParameter = context.data?.[parameter];

				let condition = false;

				let precheck = false;

				let tmp = [];

				if (userParameter) {
					switch (method) {
						case 'contains': {
							condition = userParameter.includes(value);
							break;
						}
						case 'equals': {
							condition = (userParameter === value);
							break;
						}
						case 'startswith': {
							condition = userParameter.startsWith(value);
							break;
						}
						case 'endswith': {
							condition = userParameter.endsWith(value);
							break;
						}
						default: {
							// should not be possible; 
							break;
						}
					}
				}

				if (negate) {
					condition = !condition;
				}
				if (condition) {
					
					switch (action) {
						case 'groupUsers': {
							// -> action db/service -> currentuser id + accessId assigment
							if (accessId) {
								tmp = await context.app.service(action).find({
									paginate: false, // Fetch all relevant records
									query: {
										groupId: parseInt(accessId),
										userId: parseInt(context.result.id)
									}
								});
								precheck = tmp.length == 0;

								if (precheck) {
									context.app.service(action).create({ groupId: parseInt(accessId), userId: context.result.id });
								}
							}
							break;
						}
						case 'tenantOwners': {
							// Make user tenant Owner (tenant owner table)
							tmp = await context.app.service(action).find({
								paginate: false, // Fetch all relevant records
								query: {
									tenantId: parseInt(context.data.tenantId),
									userId: parseInt(context.result.id)
								}
							});
							precheck = tmp.length == 0;

							if (precheck) {
								context.app.service(action).create({ tenantId: context.data.tenantId, userId: context.result.id });
							}

							break;
						}
						case 'tenantAdmins': {
							// Make user tenant Admin (tenant admin table)
							tmp = await context.app.service(action).find({
								paginate: false, // Fetch all relevant records
								query: {
									tenantId: parseInt(context.data.tenantId),
									userId: parseInt(context.result.id)
								}
							});
							precheck = tmp.length == 0;

							if (precheck) {
								context.app.service(action).create({ tenantId: context.data.tenantId, userId: context.result.id });
							}

							break;
						}
						case 'userRole': {
							// TODO
							break;
						}
						case 'superAdmin': {
							// Make user super-admin (user table)
							tmp = context.result.roles;
							precheck = tmp == null || !tmp.includes('super-admin');
							if (precheck) {
								context.app.service('users').patch(context.result.id, { roles: [ 'super-admin' ] });
							}
							break;
						}
						default: {
							// should not be possible; 
							break;
						}
					}
				}
			});
		}
	}
};