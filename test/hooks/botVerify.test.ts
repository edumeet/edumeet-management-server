import assert from 'assert';

import { addressAllowed, decideBot, hashBotToken, invalidRanges, isTokenHash, parseRange } from '../../src/bots/verify';

const token = 'not-so-secret-test-token';
const credential = (over: Record<string, unknown> = {}) => ({
	id: 5,
	label: 'Recorder A',
	tokenHash: hashBotToken(token),
	allowedIps: [ '10.0.0.0/8', '2001:db8::/32' ],
	enabled: true,
	...over,
});

describe('bot ranges', () => {
	it('parses single addresses and CIDR ranges of both families', () => {
		assert.deepStrictEqual(parseRange('192.168.1.10'), { address: '192.168.1.10', prefix: 32, family: 'ipv4' });
		assert.deepStrictEqual(parseRange('192.168.0.0/16'), { address: '192.168.0.0', prefix: 16, family: 'ipv4' });
		assert.deepStrictEqual(parseRange('2001:db8::1'), { address: '2001:db8::1', prefix: 128, family: 'ipv6' });
		assert.deepStrictEqual(parseRange(' 2001:db8::/32 '), { address: '2001:db8::', prefix: 32, family: 'ipv6' });
	});

	it('refuses anything that is not an address or a range', () => {
		assert.deepStrictEqual(
			invalidRanges([ 'recorder.example.edu', '10.0.0.0/33', '10.0.0.0/8/1', '', '1.2.3', '2001:db8::/129', '10.0.0.0/x' ]),
			[ 'recorder.example.edu', '10.0.0.0/33', '10.0.0.0/8/1', '', '1.2.3', '2001:db8::/129', '10.0.0.0/x' ]
		);
		assert.deepStrictEqual(invalidRanges([ '10.0.0.1', '0.0.0.0/0', '::/0' ]), []);
	});

	it('matches an address against the ranges, folding IPv4-mapped IPv6', () => {
		const ranges = [ '10.1.0.0/16', '203.0.113.7', '2001:db8:1::/48' ];

		assert.strictEqual(addressAllowed(ranges, '10.1.200.3'), true);
		assert.strictEqual(addressAllowed(ranges, '10.2.0.1'), false);
		assert.strictEqual(addressAllowed(ranges, '203.0.113.7'), true);
		assert.strictEqual(addressAllowed(ranges, '203.0.113.8'), false);
		assert.strictEqual(addressAllowed(ranges, '::ffff:10.1.0.9'), true);
		assert.strictEqual(addressAllowed(ranges, '2001:db8:1:2::5'), true);
		assert.strictEqual(addressAllowed(ranges, '2001:db8:2::5'), false);
		assert.strictEqual(addressAllowed(ranges, 'garbage'), false);
	});

	it('lets everything through only when told so explicitly', () => {
		assert.strictEqual(addressAllowed([ '0.0.0.0/0' ], '198.51.100.1'), true);
		assert.strictEqual(addressAllowed([ '0.0.0.0/0' ], '2001:db8::1'), false);
		assert.strictEqual(addressAllowed([ '::/0' ], '2001:db8::1'), true);
	});
});

describe('bot token hash', () => {
	it('is the hex SHA-256 the form computes', () => {
		assert.strictEqual(hashBotToken('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
		assert.strictEqual(isTokenHash(hashBotToken('abc')), true);
		assert.strictEqual(isTokenHash('ABC'), false);
		assert.strictEqual(isTokenHash(42), false);
	});
});

describe('decideBot', () => {
	const address = '10.20.30.40';

	it('refuses every bot while the policy is disabled', () => {
		for (const policy of [ 'disabled', undefined, null, 'garbage' ]) {
			assert.deepStrictEqual(decideBot({ policy, address, credentials: [ credential() ] }), { allowed: false, reason: 'botsNotAllowed' });
			assert.deepStrictEqual(decideBot({ policy, botToken: token, address, credentials: [ credential() ] }), { allowed: false, reason: 'botsNotAllowed' });
		}
	});

	it('requires a token under tokenOnly and admits a generic bot under all', () => {
		assert.deepStrictEqual(decideBot({ policy: 'tokenOnly', address, credentials: [] }), { allowed: false, reason: 'botsNotAllowed' });
		assert.deepStrictEqual(decideBot({ policy: 'all', address, credentials: [] }), { allowed: true, verified: false });
	});

	it('verifies a bot with the right token from an allowed address', () => {
		for (const policy of [ 'tokenOnly', 'all' ]) {
			assert.deepStrictEqual(
				decideBot({ policy, botToken: token, address, credentials: [ credential() ] }),
				{ allowed: true, verified: true, label: 'Recorder A', credentialId: 5 }
			);
		}
	});

	it('refuses a wrong token, a disabled credential and a foreign address with one reason', () => {
		const rejected = { allowed: false, reason: 'botTokenRejected' };

		assert.deepStrictEqual(decideBot({ policy: 'all', botToken: 'wrong', address, credentials: [ credential() ] }), rejected);
		assert.deepStrictEqual(decideBot({ policy: 'all', botToken: token, address, credentials: [ credential({ enabled: false }) ] }), rejected);
		assert.deepStrictEqual(decideBot({ policy: 'all', botToken: token, address, credentials: [ credential({ enabled: 0 }) ] }), rejected);
		assert.deepStrictEqual(decideBot({ policy: 'all', botToken: token, address: '192.0.2.1', credentials: [ credential() ] }), rejected);
	});

	it('never downgrades a failed token to a generic bot', () => {
		assert.deepStrictEqual(decideBot({ policy: 'all', botToken: 'wrong', address, credentials: [] }), { allowed: false, reason: 'botTokenRejected' });
	});

	it('reads a MySQL tinyint enabled flag', () => {
		assert.strictEqual(decideBot({ policy: 'all', botToken: token, address, credentials: [ credential({ enabled: 1 }) ] }).allowed, true);
	});
});
