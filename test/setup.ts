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

	const setChromeOnTarget = (target: unknown) => {
		if (target && (typeof target === 'object' || typeof target === 'function')) {
			(target as { chrome?: typeof chrome }).chrome = chrome;
		}
	};

	// Set chrome on globalThis immediately in hoisted context
	if (typeof globalThis !== 'undefined') {
		setChromeOnTarget(globalThis);
	}
	if (typeof global !== 'undefined') {
		setChromeOnTarget(global);
	}

	return { mockChromeStorageLocal: local, mockChromeStorageSync: sync, mockChromeStorage: chrome };
});

// Use vi.stubGlobal to make chrome available as a direct variable
vi.stubGlobal('chrome', mockChromeStorage);

// Also set it directly on globalThis and global as fallback
if (typeof globalThis !== 'undefined') {
	(globalThis as unknown as { chrome?: typeof mockChromeStorage }).chrome = mockChromeStorage;
}
if (typeof global !== 'undefined') {
	(global as unknown as { chrome?: typeof mockChromeStorage }).chrome = mockChromeStorage;
}

const defineChromeProperty = (target: unknown) => {
	if (target && typeof target === 'object') {
		try {
			Object.defineProperty(target, 'chrome', {
				value: mockChromeStorage,
				writable: true,
				enumerable: true,
				configurable: true,
			});
		} catch {
			// Ignore if descriptor cannot be redefined
		}
	}
};

if (typeof globalThis !== 'undefined') {
	defineChromeProperty(globalThis);
}
if (typeof global !== 'undefined') {
	defineChromeProperty(global);
}

// Export mocks for use in tests
export { mockChromeStorageLocal, mockChromeStorageSync, mockChromeStorage };
