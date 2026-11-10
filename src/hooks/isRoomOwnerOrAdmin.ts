import { Forbidden } from '@feathersjs/errors';
import { HookContext } from '../declarations';

type RoomRowPath = 'rooms' | 'roomOwners' | 'roomGroupRoles' | 'roomUserRoles';

/**
 * Every room a request touches. With an id, the room of the stored row (for rooms/:id the
 * row is the room), whatever the body says; a body that moves the row adds the room it moves
 * to. Without an id, the room named in the body, else in the query. All must pass. Taking
 * the body's roomId first let a room owner change another room's rows by naming their own.
 */
const roomsOfRequest = async (context: HookContext, path: RoomRowPath): Promise<string[]> => {
	const rooms: string[] = [];

	if (context.id !== undefined && context.id !== null) {
		if (path === 'rooms') rooms.push(String(context.id));
		else {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const row = await (context.app.service(path) as any).get(context.id, { ...context.params, provider: undefined, query: {} });

			rooms.push(String(row.roomId));
		}
	}

	const rows: Array<Record<string, unknown>> = Array.isArray(context.data) ? context.data : context.data ? [ context.data ] : [];

	for (const row of rows) if (row.roomId !== undefined && row.roomId !== null) rooms.push(String(row.roomId));

	if (rooms.length === 0 && context.params?.query?.roomId != null) rooms.push(String(context.params.query.roomId));

	return [ ...new Set(rooms) ];
};

const assertRoomOwnerOrAdmin = async (context: HookContext, roomId: string): Promise<void> => {
	const { user } = context.params;

	if (user?.tenantAdmin || user?.tenantOwner) {
		// is tenant admin but still might be from an other tenant
		const { tenantId } = await context.app.service('rooms').get(roomId);

		if (tenantId && tenantId != parseInt(context.params.user.tenantId))
			throw new Forbidden('You are not an owner of this room');

		return;
	}

	const { total } = await context.app.service('roomOwners').find({
		query: {
			roomId: parseInt(roomId),
			userId: context.params.user.id
		}
	});

	if (total === 0)
		throw new Forbidden('You are not an owner of this room');
};

const checkRooms = (path?: RoomRowPath) => async (context: HookContext): Promise<void> => {
	// We only care about external calls
	if (!context.params.provider) return;

	const roomIds = await roomsOfRequest(context, path ?? context.path as RoomRowPath);

	if (roomIds.length === 0) throw new Error('No room id provided');

	for (const roomId of roomIds) await assertRoomOwnerOrAdmin(context, roomId);
};

// For rooms, roomOwners and roomGroupRoles (by the service the hook runs on).
export const isRoomOwnerOrAdmin = checkRooms();

export const isRoomOwnerOrAdminRoomIdOfGroupRole = checkRooms('roomGroupRoles');

export const isRoomOwnerOrAdminRoomIdOfUserRole = checkRooms('roomUserRoles');
