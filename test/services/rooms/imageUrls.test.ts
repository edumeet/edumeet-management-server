import assert from 'assert';
import { roomDataValidator, roomPatchValidator } from '../../../src/services/rooms/rooms.schema';
import { defaultPatchValidator } from '../../../src/services/defaults/defaults.schema';

type Validator = (value: Record<string, unknown>) => Promise<unknown>; // eslint-disable-line no-unused-vars

const accepted = async (validator: Validator, data: Record<string, unknown>) => {
	try {
		await validator(data);

		return true;
	} catch {
		return false;
	}
};

// The background goes into every participant's CSS as url(...); the logo is shown to them too.
describe('room and tenant background and logo', () => {
	const good = [ '', 'https://cdn.example.org/bg.jpg', 'http://x.example/a.png?size=2&v=1#top', '/images/bg.jpg', 'images/bg.jpg' ];
	const bad = [
		'x);}body{display:none}.a{',
		'https://x.example/a b.png',
		'https://x.example/a"b.png',
		'https://x.example/a\'b.png',
		'https://x.example/a(1).png',
		'javascript:alert(1)',
		'data:image/png;base64,iVBORw0KGgo=',
		'//evil.example/bg.png',
		`https://x.example/${'a'.repeat(250)}`
	];

	for (const key of [ 'background', 'logo' ]) {
		it(`accept only a URL or path that cannot end url() or a CSS rule: ${key}`, async () => {
			for (const validator of [ roomPatchValidator, defaultPatchValidator ]) {
				for (const value of good) assert.ok(await accepted(validator, { [key]: value }), `${key}=${value}`);
				for (const value of bad) assert.strictEqual(await accepted(validator, { [key]: value }), false, `${key}=${value}`);
			}

			assert.ok(await accepted(roomDataValidator, { name: 'room', [key]: good[1] }), 'a new room with a valid value');
			assert.strictEqual(await accepted(roomDataValidator, { name: 'room', [key]: bad[0] }), false);
		});
	}
});
