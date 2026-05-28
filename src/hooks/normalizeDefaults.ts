import { HookContext } from '../declarations';

// These map to `bigint` columns. Postgres returns bigint as a string on read,
// and an unset column reads back as null. The client round-trips those values
// (often via parseInt, which yields NaN -> JSON null) and the data validator
// does not coerce types, so the strict `number` schema rejects them. Coerce each
// field to a number, dropping it when it isn't finite so the existing value is
// preserved instead of failing validation.
const INTEGER_FIELDS = [
	'tenantId',
	'numberLimit',
	'liveNumberLimit',
	'userManagedRoomNumberLimit',
	'managerManagedRoomNumberLimit',
	'maxFileSize',
	'defaultRoleId'
];

export const normalizeDefaults = (context: HookContext): void => {
	const data = context.data as Record<string, unknown> | undefined;

	if (!data) return;

	for (const field of INTEGER_FIELDS) {
		if (!(field in data)) continue;

		const value = parseInt(String(data[field]), 10);

		if (Number.isFinite(value)) data[field] = value;
		else delete data[field];
	}
};
