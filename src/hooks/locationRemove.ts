import { HookContext, NextFunction } from '../declarations';
import { Location } from '../services/locations/locations.schema';

export const locationRemove = async (context: HookContext, next: NextFunction) => {
	await next();

	// The removed location
	const { id } = context.result as Location;

	// Remove all media-nodes
	const mediaNodes = await context.app.service('mediaNodes').find({
		query: {
			locationId: id
		}
	});

	await Promise.all(mediaNodes.data.map((mediaNode) => context.app.service('mediaNodes').remove(mediaNode.id)));
};