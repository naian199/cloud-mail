import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from '../../mail-vue/src/utils/uuid.js';

test('older Safari can create secure version 4 identifiers without native randomUUID', () => {
	const native = Object.getOwnPropertyDescriptor(globalThis.crypto, 'randomUUID');
	Object.defineProperty(globalThis.crypto, 'randomUUID', { value: undefined, configurable: true });
	try {
		const values = Array.from({ length: 100 }, () => randomUUID());
		assert.equal(new Set(values).size, values.length);
		for (const value of values)
			assert.match(value, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
	} finally {
		if (native) Object.defineProperty(globalThis.crypto, 'randomUUID', native);
		else delete globalThis.crypto.randomUUID;
	}
	assert.match(randomUUID(), /^[0-9a-f-]{36}$/);
});
