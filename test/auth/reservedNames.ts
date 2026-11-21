import dns from 'dns';

// eslint-disable-next-line no-unused-vars
type PromisesLookup = (hostname: string, options?: unknown) => Promise<unknown>;

// Names under .example never resolve (RFC 2606), but some resolvers take seconds to say so,
// longer than a test may run. The tests that use them answer for them without the network.
export const answerReservedNamesLocally = (): () => void => {
	const promises = dns.promises as unknown as { lookup: PromisesLookup };
	const lookup = promises.lookup;

	promises.lookup = (hostname, options) => (hostname.toLowerCase().endsWith('.example')
		? Promise.reject(Object.assign(new Error(`getaddrinfo ENOTFOUND ${hostname}`), { code: 'ENOTFOUND', hostname }))
		: lookup(hostname, options));

	return () => {
		promises.lookup = lookup;
	};
};
