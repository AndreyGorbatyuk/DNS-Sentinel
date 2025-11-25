import { vi } from 'vitest';

// Use vi.hoisted to ensure chrome is set up before any module evaluation
const { mockChromeStorageLocal, mockChromeStorageSync, mockChromeStorage } = vi.hoisted(() => {
	// Default all methods to return resolved promises
	const local = {
		get: vi.fn().mockResolvedValue({}),
		set: vi.fn().mockResolvedValue(undefined),
		remove: vi.fn().mockResolvedValue(undefined),
		clear: vi.fn().mockResolvedValue(undefined),
	};

	const sync = {
		get: vi.fn().mockResolvedValue({}),
		set: vi.fn().mockResolvedValue(undefined),
		remove: vi.fn().mockResolvedValue(undefined),
		clear: vi.fn().mockResolvedValue(undefined),
	};

	const chrome = {
		storage: {
			local,
			sync,
		},
	};

	// Set chrome on globalThis immediately in hoisted context
	if (typeof globalThis !== 'undefined') {
		(globalThis as any).chrome = chrome;
	}
	if (typeof global !== 'undefined') {
		(global as any).chrome = chrome;
	}

	return { mockChromeStorageLocal: local, mockChromeStorageSync: sync, mockChromeStorage: chrome };
});

// Use vi.stubGlobal to make chrome available as a direct variable
vi.stubGlobal('chrome', mockChromeStorage);

// Also set it directly on globalThis and global as fallback
if (typeof globalThis !== 'undefined') {
	(globalThis as any).chrome = mockChromeStorage;
}
if (typeof global !== 'undefined') {
	(global as any).chrome = mockChromeStorage;
}

// Use Object.defineProperty to ensure it's accessible
try {
	if (typeof globalThis !== 'undefined') {
		Object.defineProperty(globalThis, 'chrome', {
			value: mockChromeStorage,
			writable: true,
			enumerable: true,
			configurable: true,
		});
	}
	if (typeof global !== 'undefined') {
		Object.defineProperty(global, 'chrome', {
			value: mockChromeStorage,
			writable: true,
			enumerable: true,
			configurable: true,
		});
	}
} catch (e) {
	// Ignore if it fails
}

// Export mocks for use in tests
export { mockChromeStorageLocal, mockChromeStorageSync, mockChromeStorage };

