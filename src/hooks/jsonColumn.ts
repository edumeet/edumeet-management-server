import type { HookContext } from '../declarations';

// MySQL keeps these arrays in a JSON column, and the driver would send a JavaScript array as
// a list of values, which MySQL refuses as JSON. Postgres keeps them as native arrays.
export const jsonColumn = async <T>(value: T, _data: unknown, context: HookContext): Promise<T> => {
	const client = context.app.get('postgresql')?.client;

	return Array.isArray(value) && (client === 'mysql' || client === 'mysql2')
		? JSON.stringify(value) as unknown as T
		: value;
};
