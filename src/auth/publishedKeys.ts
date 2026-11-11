import { createHash, createPublicKey } from 'crypto';

// SHA-256 of the public key (SPKI, DER) of the key pair published with eduMeet: its private
// key is in config/default.json and certs/rsa_4096_priv.pem here and in edumeet-docker's
// configs/mgmt/default.example.json, its public key in the room server's example config.
// Anyone can sign tokens with it, for example as a super admin, so it must never be used.
// utils/run-me-first.sh in edumeet-docker makes a new key pair. Taken from the derived public
// key, so the key is recognised in any format (PKCS#8, PKCS#1, other line breaks).
const PUBLISHED_KEY_FINGERPRINTS = new Set([
	'97e82e09ad25be80602e8146c04927a6d7a42c642250c9a72966b75024122177'
]);

const fingerprint = (key: string): string | undefined => {
	try {
		return createHash('sha256').update(createPublicKey(key).export({ type: 'spki', format: 'der' }))
			.digest('hex');
	} catch {
		// Not a key we can read (for example an HMAC secret): not the published one.
		return undefined;
	}
};

export const isPublishedKey = (secret: unknown): boolean => {
	if (typeof secret !== 'string') return false;

	const print = fingerprint(secret);

	return print !== undefined && PUBLISHED_KEY_FINGERPRINTS.has(print);
};

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
