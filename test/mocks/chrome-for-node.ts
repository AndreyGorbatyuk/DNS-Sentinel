const storage = new Map<string, any>();

if (typeof globalThis !== 'undefined' && !globalThis.chrome) {
	(globalThis as any).chrome = {
		storage: {
			local: {
				get: async (keys: string | string[] | Record<string, any> | null) => {
					if (!keys) return {};
					const keyArray = Array.isArray(keys) ? keys : typeof keys === 'string' ? [keys] : Object.keys(keys);
					const result: Record<string, any> = {};
					for (const key of keyArray) {
						if (storage.has(key)) {
							result[key] = storage.get(key);
						}
					}
					return result;
				},
				set: async (items: Record<string, any>) => {
					for (const [key, value] of Object.entries(items)) {
						storage.set(key, value);
					}
				},
				remove: async (keys: string | string[]) => {
					const keyArray = Array.isArray(keys) ? keys : [keys];
					for (const key of keyArray) {
						storage.delete(key);
					}
				},
				clear: async () => {
					storage.clear();
				},
			},
		},
	};
}

