import { HookContext } from '../declarations';

export const assertRules = async (context: HookContext): Promise<void> => {
	// ignore tenantid for local admin
	if (context.data?.tenantId) {
		const rulesService = context.app.service('rules');

		const rules = await rulesService.find({
			paginate: false, // Fetch all relevant records
			query: {
				tenantId: parseInt(context.data.tenantId),
				type: 'assert'
			}
		});
	
		if (rules && rules.length!=0) {
			rules.forEach((rule) => {
				const parameter = rule.parameter; // user parameter to check for method (like: email)
				const method = rule.method; // contains, equals, startswith, endswith
				const negate = rule.negate; // true/false  negates method
				const value = rule.value; // int / string that parameter is matched with
						
				const userParameter = context.data?.[parameter];

				let condition = false;

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
					// user creation is not allowed contact Administrator
					throw new Error('Action not allowed by rule');
				} 

			});
		}
	}
};