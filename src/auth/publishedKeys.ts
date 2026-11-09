import { createHash } from 'crypto';

// SHA-256 of the base64 body of the private key in config/default.json, which edumeet-docker
// also ships in configs/mgmt/default.example.json. Anyone can sign tokens with it, for
// example as a super admin, so it must never be used to sign. utils/run-me-first.sh in
// edumeet-docker replaces it with a new key pair.
const PUBLISHED_KEY_FINGERPRINTS = new Set([
	'7c67e601abeeb917db72c9cb7db17626ef71bca6680f9196da056242fbd92af7'
]);

const fingerprint = (pem: string): string =>
	createHash('sha256').update(pem.replace(/-----[^-]+-----/g, '').replace(/\s/g, ''))
		.digest('hex');

export const isPublishedKey = (secret: unknown): boolean =>
	typeof secret === 'string' && PUBLISHED_KEY_FINGERPRINTS.has(fingerprint(secret));

export const PUBLISHED_KEY_MESSAGE =
	'authentication.secret is the private key published with eduMeet, so anyone could sign tokens for this server. ' +
	'Generate a new key pair (edumeet-docker: utils/run-me-first.sh; otherwise: openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:4096), ' +
	'put the private key in authentication.secret and the public key in the room server\'s managementService.jwtPublicKeys.';

/**
 * Throws when the configured signing key is the published one. The test suite runs on the
 * repository's config, so NODE_ENV=test is exempt.
 */
export const assertSigningKeyNotPublished = (secret: unknown, env = process.env.NODE_ENV): void => {
	if (env !== 'test' && isPublishedKey(secret)) throw new Error(PUBLISHED_KEY_MESSAGE);
};
