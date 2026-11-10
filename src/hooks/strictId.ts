import { BadRequest } from '@feathersjs/errors';

/**
 * An id from a request as the database will read it, or a BadRequest. parseInt('5.7') is 5,
 * while MySQL stores 5.7 in a bigint column as 6: a check made on the parsed value would be
 * about another row than the one written.
 */
export const strictId = (value: unknown, name = 'id'): number => {
	const id = typeof value === 'string' && /^[0-9]+$/.test(value) ? Number(value) : value;

	if (typeof id !== 'number' || !Number.isSafeInteger(id) || id < 1) throw new BadRequest(`${name} must be a positive integer`);

	return id;
};
