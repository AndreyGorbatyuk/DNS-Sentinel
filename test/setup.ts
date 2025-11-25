import { vi } from 'vitest';

// Set up chrome mock before any tests run
// Default all methods to return resolved promises
const mockChromeStorageLocal = {
	get: vi.fn().mockResolvedValue({}),
	set: vi.fn().mockResolvedValue(undefined),
	remove: vi.fn().mockResolvedValue(undefined),
	clear: vi.fn().mockResolvedValue(undefined),
};

const mockChromeStorageSync = {
	get: vi.fn().mockResolvedValue({}),
	set: vi.fn().mockResolvedValue(undefined),
	remove: vi.fn().mockResolvedValue(undefined),
	clear: vi.fn().mockResolvedValue(undefined),
};

const mockChromeStorage = {
	local: mockChromeStorageLocal,
	sync: mockChromeStorageSync,
};

// Use vi.stubGlobal to ensure chrome is available globally
vi.stubGlobal('chrome', mockChromeStorage);

// Set it on all possible global objects to ensure it's accessible
if (typeof globalThis !== 'undefined') {
	(globalThis as any).chrome = mockChromeStorage;
}
if (typeof global !== 'undefined') {
	(global as any).chrome = mockChromeStorage;
}
// In Node.js, also set it on the process global
if (typeof process !== 'undefined' && (process as any).global) {
	((process as any).global as any).chrome = mockChromeStorage;
}

// Use Object.defineProperty to make it non-configurable and ensure it persists
try {
	Object.defineProperty(globalThis, 'chrome', {
		value: mockChromeStorage,
		writable: true,
		enumerable: true,
		configurable: true,
	});
} catch (e) {
	// Ignore if it fails
}

// Export mocks for use in tests
export { mockChromeStorageLocal, mockChromeStorageSync, mockChromeStorage };

