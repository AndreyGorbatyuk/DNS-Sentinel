/**
 * @file benchmarks/domain-profile-update.bench.ts
 * @description Performance benchmarks for domain profile updates
 * Focus on hotspot operations: storage I/O, Welford updates, array operations, pruning
 * @uses src/storage/domain-statistics.ts
 * @uses types.ts
 */

import { beforeEach, bench, describe } from 'vitest';
import type { DomainProfile, WelfordStats } from '../src/types/index.js';

// Mock chrome.storage.local with performance tracking
type StorageRecord = Record<string, unknown>;

let storageData: StorageRecord = {};
let storageOps = 0;

const mockChromeStorage = {
	local: {
		get: async (key: string | string[] | StorageRecord | null): Promise<StorageRecord> => {
			storageOps++;
			if (key === null) {
				return { ...storageData };
			}
			if (typeof key === 'string') {
				return { [key]: storageData[key] };
			}
			if (Array.isArray(key)) {
				const result: StorageRecord = {};
				for (const k of key) {
					if (k in storageData) {
						result[k] = storageData[k];
					}
				}
				return result;
			}
			return {};
		},
		set: async (items: StorageRecord): Promise<void> => {
			storageOps++;
			Object.assign(storageData, items);
		},
		remove: async (keys: string | string[]) => {
			storageOps++;
			const keyArray = Array.isArray(keys) ? keys : [keys];
			for (const key of keyArray) {
				delete storageData[key];
			}
		},
		clear: async () => {
			storageOps++;
			storageData = {};
		},
	},
};

(globalThis as any).chrome = { storage: mockChromeStorage };

// Mock domain statistics functions
const getDomainProfile = async (domain: string): Promise<DomainProfile | null> => {
	const key = `profile_${domain}`;
	const data = await chrome.storage.local.get(key);
	return data[key] || null;
};

const updateDomainProfile = async (domain: string, profile: DomainProfile): Promise<void> => {
	const key = `profile_${domain}`;
	await chrome.storage.local.set({ [key]: profile });
};

const deleteDomainProfile = async (domain: string): Promise<void> => {
	const key = `profile_${domain}`;
	await chrome.storage.local.remove(key);
};

const getAllProfiles = async (): Promise<DomainProfile[]> => {
	const data = await chrome.storage.local.get(null);
	return Object.keys(data)
		.filter((key) => key.startsWith('profile_'))
		.map((key) => data[key]);
};

// Helper: Generate profile
function generateProfile(
	domain: string,
	requestCount: number,
	lastSeen: number = Date.now(),
): DomainProfile {
	const now = Date.now();
	const timestamps = Array.from({ length: Math.min(requestCount, 120) }, (_, i) => now - i * 1000);

	return {
		domain,
		firstSeen: now - requestCount * 1000,
		lastSeen,
		requestCount,
		timeSeries: {
			minutely: timestamps.slice(0, 60),
			fiveMinute: timestamps.slice(0, 120),
			fifteenMinute: timestamps,
		},
		stats: {
			rate: {
				oneMinute: { count: requestCount, mean: 1.0, M2: 0.5 },
				fiveMinute: { count: requestCount, mean: 1.0, M2: 0.5 },
				fifteenMinute: { count: requestCount, mean: 1.0, M2: 0.5 },
			},
			interArrival: { count: requestCount, mean: 1000, M2: 100000 },
		},
		accessHours: Array(24).fill(Math.floor(requestCount / 24)),
		dayFrequencies: Array(7).fill(Math.floor(requestCount / 7)),
		typicalReferrers: ['https://google.com', 'https://example.com'],
		_version: 2,
		_updatedAt: now,
	};
}

describe('DomainProfile Update Benchmarks', () => {
	beforeEach(() => {
		storageData = {};
		storageOps = 0;
	});

	describe('HOTSPOT: Chrome Storage Operations', () => {
		bench('storage.get (single profile)', async () => {
			const profile = generateProfile('example.com', 10);
			await chrome.storage.local.set({ 'profile_example.com': profile });
			await chrome.storage.local.get('profile_example.com');
		});

		bench('storage.set (single profile)', async () => {
			const profile = generateProfile('example.com', 10);
			await chrome.storage.local.set({ 'profile_example.com': profile });
		});

		bench('storage.get (10 profiles)', async () => {
			// Populate storage
			for (let i = 0; i < 10; i++) {
				const profile = generateProfile(`example${i}.com`, 10);
				await chrome.storage.local.set({ [`profile_example${i}.com`]: profile });
			}
			// Fetch all
			const keys = Array.from({ length: 10 }, (_, i) => `profile_example${i}.com`);
			await chrome.storage.local.get(keys);
		});

		bench('storage.set (10 profiles)', async () => {
			const profiles: Record<string, DomainProfile> = {};
			for (let i = 0; i < 10; i++) {
				profiles[`profile_example${i}.com`] = generateProfile(`example${i}.com`, 10);
			}
			await chrome.storage.local.set(profiles);
		});

		bench('storage.get (null - all profiles, 100 items)', async () => {
			// Populate storage
			for (let i = 0; i < 100; i++) {
				const profile = generateProfile(`example${i}.com`, 10);
				await chrome.storage.local.set({ [`profile_example${i}.com`]: profile });
			}
			// Fetch all
			await chrome.storage.local.get(null);
		});

		bench('storage.remove (single profile)', async () => {
			const profile = generateProfile('example.com', 10);
			await chrome.storage.local.set({ 'profile_example.com': profile });
			await chrome.storage.local.remove('profile_example.com');
		});

		bench('storage.remove (10 profiles)', async () => {
			// Populate storage
			for (let i = 0; i < 10; i++) {
				const profile = generateProfile(`example${i}.com`, 10);
				await chrome.storage.local.set({ [`profile_example${i}.com`]: profile });
			}
			// Remove all
			const keys = Array.from({ length: 10 }, (_, i) => `profile_example${i}.com`);
			await chrome.storage.local.remove(keys);
		});
	});

	describe('HOTSPOT: Welford Statistics Incremental Update', () => {
		bench('Welford update (cold start)', () => {
			const stats: WelfordStats = { count: 0, mean: 0, M2: 0 };
			const value = 1.0;

			stats.count += 1;
			const delta = value - stats.mean;
			stats.mean += delta / stats.count;
			const delta2 = value - stats.mean;
			stats.M2 += delta * delta2;
		});

		bench('Welford update (warm, 100 samples)', () => {
			const stats: WelfordStats = { count: 100, mean: 5.0, M2: 50.0 };
			const value = 6.0;

			stats.count += 1;
			const delta = value - stats.mean;
			stats.mean += delta / stats.count;
			const delta2 = value - stats.mean;
			stats.M2 += delta * delta2;
		});

		bench('Welford update (warm, 1000 samples)', () => {
			const stats: WelfordStats = { count: 1000, mean: 10.0, M2: 500.0 };
			const value = 12.0;

			stats.count += 1;
			const delta = value - stats.mean;
			stats.mean += delta / stats.count;
			const delta2 = value - stats.mean;
			stats.M2 += delta * delta2;
		});

		bench('Welford batch update (10 values)', () => {
			const stats: WelfordStats = { count: 0, mean: 0, M2: 0 };
			const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

			for (const value of values) {
				stats.count += 1;
				const delta = value - stats.mean;
				stats.mean += delta / stats.count;
				const delta2 = value - stats.mean;
				stats.M2 += delta * delta2;
			}
		});

		bench('Welford batch update (100 values)', () => {
			const stats: WelfordStats = { count: 0, mean: 0, M2: 0 };
			const values = Array.from({ length: 100 }, (_, i) => i + 1);

			for (const value of values) {
				stats.count += 1;
				const delta = value - stats.mean;
				stats.mean += delta / stats.count;
				const delta2 = value - stats.mean;
				stats.M2 += delta * delta2;
			}
		});

		bench('variance calculation from M2', () => {
			const stats: WelfordStats = { count: 100, mean: 10.0, M2: 500.0 };
			const variance = stats.count > 1 ? stats.M2 / (stats.count - 1) : 0;
		});
	});

	describe('HOTSPOT: Time Series Array Operations', () => {
		bench('push timestamp to empty array', () => {
			const series: number[] = [];
			series.push(Date.now());
		});

		bench('push timestamp to array (60 items)', () => {
			const series = Array.from({ length: 60 }, (_, i) => Date.now() - i * 1000);
			series.push(Date.now());
		});

		bench('push + shift (circular buffer, 120 items)', () => {
			const series = Array.from({ length: 120 }, (_, i) => Date.now() - i * 1000);
			series.push(Date.now());
			if (series.length > 120) {
				series.shift();
			}
		});

		bench('filter old timestamps (60 of 120)', () => {
			const now = Date.now();
			const series = Array.from({ length: 120 }, (_, i) => now - i * 1000);
			const cutoff = now - 60000;
			const filtered = series.filter((ts) => ts >= cutoff);
		});

		bench('filter old timestamps (300 of 600)', () => {
			const now = Date.now();
			const series = Array.from({ length: 600 }, (_, i) => now - i * 1000);
			const cutoff = now - 300000;
			const filtered = series.filter((ts) => ts >= cutoff);
		});

		bench('slice last N elements (60 of 120)', () => {
			const series = Array.from({ length: 120 }, (_, i) => Date.now() - i * 1000);
			const sliced = series.slice(-60);
		});

		bench('array length check (avoid redundant operations)', () => {
			const series = Array.from({ length: 120 }, (_, i) => Date.now() - i * 1000);
			if (series.length > 120) {
				series.shift();
			}
		});
	});

	describe('HOTSPOT: Profile Deep Clone', () => {
		bench('shallow clone (spread operator)', () => {
			const profile = generateProfile('example.com', 100);
			const cloned = { ...profile };
		});

		bench('deep clone (JSON.parse + JSON.stringify)', () => {
			const profile = generateProfile('example.com', 100);
			const cloned = JSON.parse(JSON.stringify(profile));
		});

		bench('structured clone (modern API)', () => {
			const profile = generateProfile('example.com', 100);
			const cloned = structuredClone(profile);
		});

		bench('manual deep clone (arrays + objects)', () => {
			const profile = generateProfile('example.com', 100);
			const cloned: DomainProfile = {
				...profile,
				timeSeries: {
					minutely: [...profile.timeSeries.minutely],
					fiveMinute: [...profile.timeSeries.fiveMinute],
					fifteenMinute: [...profile.timeSeries.fifteenMinute],
				},
				stats: {
					rate: {
						oneMinute: { ...profile.stats.rate.oneMinute },
						fiveMinute: { ...profile.stats.rate.fiveMinute },
						fifteenMinute: { ...profile.stats.rate.fifteenMinute },
					},
					interArrival: profile.stats.interArrival ? { ...profile.stats.interArrival } : undefined,
				},
				accessHours: profile.accessHours ? [...profile.accessHours] : undefined,
				dayFrequencies: profile.dayFrequencies ? [...profile.dayFrequencies] : undefined,
				typicalReferrers: profile.typicalReferrers ? [...profile.typicalReferrers] : undefined,
			};
		});
	});

	describe('HOTSPOT: Profile Pruning', () => {
		bench('prune 10 old profiles (out of 100)', async () => {
			// Populate storage with 100 profiles
			const now = Date.now();
			for (let i = 0; i < 100; i++) {
				const lastSeen = i < 10 ? now - 8 * 24 * 60 * 60 * 1000 : now - 60000; // 10 old, 90 recent
				const profile = generateProfile(`example${i}.com`, 10, lastSeen);
				await chrome.storage.local.set({ [`profile_example${i}.com`]: profile });
			}

			// Prune old profiles
			const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days
			const profiles = await getAllProfiles();
			let pruned = 0;

			for (const profile of profiles) {
				if (now - profile.lastSeen > maxAge) {
					await deleteDomainProfile(profile.domain);
					pruned++;
				}
			}
		});

		bench('prune excess profiles (100 -> 50)', async () => {
			// Populate storage with 100 profiles
			const now = Date.now();
			for (let i = 0; i < 100; i++) {
				const profile = generateProfile(`example${i}.com`, 10, now - i * 3600000);
				await chrome.storage.local.set({ [`profile_example${i}.com`]: profile });
			}

			// Prune excess
			const maxProfiles = 50;
			const profiles = await getAllProfiles();
			const sorted = profiles.sort((a, b) => a.lastSeen - b.lastSeen);

			let pruned = 0;
			if (sorted.length > maxProfiles) {
				const toRemove = sorted.slice(0, sorted.length - maxProfiles);
				for (const profile of toRemove) {
					await deleteDomainProfile(profile.domain);
					pruned++;
				}
			}
		});

		bench('sort profiles by lastSeen (100 profiles)', async () => {
			// Populate storage
			for (let i = 0; i < 100; i++) {
				const profile = generateProfile(`example${i}.com`, 10);
				await chrome.storage.local.set({ [`profile_example${i}.com`]: profile });
			}

			const profiles = await getAllProfiles();
			const sorted = profiles.sort((a, b) => a.lastSeen - b.lastSeen);
		});
	});

	describe('HOTSPOT: Profile Migration', () => {
		bench('migrate v1 -> v2 (add new fields)', () => {
			const v1Profile = {
				domain: 'example.com',
				firstSeen: Date.now() - 86400000,
				lastSeen: Date.now() - 3600000,
				requestCount: 50,
				timeSeries: {
					minutely: [],
					fiveMinute: [],
					fifteenMinute: [],
				},
				stats: {
					rate: {
						oneMinute: { count: 50, mean: 2.0, M2: 1.0 },
						fiveMinute: { count: 50, mean: 2.0, M2: 1.0 },
						fifteenMinute: { count: 50, mean: 2.0, M2: 1.0 },
					},
				},
			};

			const migrated: DomainProfile = {
				...v1Profile,
				stats: {
					...v1Profile.stats,
					interArrival: { count: 0, mean: 0, M2: 0 },
				},
				accessHours: Array(24).fill(0),
				dayFrequencies: Array(7).fill(0),
				typicalReferrers: [],
				_version: 2,
				_updatedAt: Date.now(),
			};
		});

		bench('check if migration needed', () => {
			const profile = generateProfile('example.com', 50);
			const currentVersion = 2;
			const needsMigration = !profile._version || profile._version < currentVersion;
		});

		bench('batch migration (10 profiles)', () => {
			const v1Profiles = Array.from({ length: 10 }, (_, i) => ({
				domain: `example${i}.com`,
				firstSeen: Date.now() - 86400000,
				lastSeen: Date.now() - 3600000,
				requestCount: 50,
				timeSeries: { minutely: [], fiveMinute: [], fifteenMinute: [] },
				stats: {
					rate: {
						oneMinute: { count: 50, mean: 2.0, M2: 1.0 },
						fiveMinute: { count: 50, mean: 2.0, M2: 1.0 },
						fifteenMinute: { count: 50, mean: 2.0, M2: 1.0 },
					},
				},
			}));

			const migrated = v1Profiles.map((v1) => ({
				...v1,
				stats: {
					...v1.stats,
					interArrival: { count: 0, mean: 0, M2: 0 },
				},
				accessHours: Array(24).fill(0),
				dayFrequencies: Array(7).fill(0),
				typicalReferrers: [],
				_version: 2,
				_updatedAt: Date.now(),
			}));
		});
	});

	describe('End-to-End: Profile CRUD Operations', () => {
		bench('create new profile', async () => {
			const profile = generateProfile('new.com', 1);
			await updateDomainProfile('new.com', profile);
		});

		bench('read existing profile', async () => {
			const profile = generateProfile('existing.com', 50);
			await updateDomainProfile('existing.com', profile);
			const retrieved = await getDomainProfile('existing.com');
		});

		bench('update existing profile (increment requestCount)', async () => {
			const profile = generateProfile('update.com', 50);
			await updateDomainProfile('update.com', profile);

			const retrieved = await getDomainProfile('update.com');
			if (retrieved) {
				retrieved.requestCount += 1;
				retrieved.lastSeen = Date.now();
				retrieved.timeSeries.minutely.push(Date.now());
				await updateDomainProfile('update.com', retrieved);
			}
		});

		bench('delete profile', async () => {
			const profile = generateProfile('delete.com', 50);
			await updateDomainProfile('delete.com', profile);
			await deleteDomainProfile('delete.com');
		});

		bench('full update cycle (read -> modify -> write)', async () => {
			const profile = generateProfile('cycle.com', 50);
			await updateDomainProfile('cycle.com', profile);

			// Read
			const retrieved = await getDomainProfile('cycle.com');
			if (retrieved) {
				// Modify
				retrieved.requestCount += 1;
				retrieved.lastSeen = Date.now();
				retrieved.timeSeries.minutely.push(Date.now());

				const value = 1.0;
				const stats = retrieved.stats.rate.oneMinute;
				stats.count += 1;
				const delta = value - stats.mean;
				stats.mean += delta / stats.count;
				const delta2 = value - stats.mean;
				stats.M2 += delta * delta2;

				// Write
				await updateDomainProfile('cycle.com', retrieved);
			}
		});
	});

	describe('Performance Regression: Profile Size', () => {
		bench('update profile (10 requests)', async () => {
			const profile = generateProfile('p10.com', 10);
			await updateDomainProfile('p10.com', profile);
		});

		bench('update profile (100 requests)', async () => {
			const profile = generateProfile('p100.com', 100);
			await updateDomainProfile('p100.com', profile);
		});

		bench('update profile (500 requests)', async () => {
			const profile = generateProfile('p500.com', 500);
			await updateDomainProfile('p500.com', profile);
		});

		bench('update profile (1000 requests)', async () => {
			const profile = generateProfile('p1000.com', 1000);
			await updateDomainProfile('p1000.com', profile);
		});

		bench('read profile (10 requests)', async () => {
			const profile = generateProfile('r10.com', 10);
			await updateDomainProfile('r10.com', profile);
			await getDomainProfile('r10.com');
		});

		bench('read profile (1000 requests)', async () => {
			const profile = generateProfile('r1000.com', 1000);
			await updateDomainProfile('r1000.com', profile);
			await getDomainProfile('r1000.com');
		});
	});

	describe('Memory Efficiency: Profile Size in Bytes', () => {
		bench('measure profile size (10 requests)', () => {
			const profile = generateProfile('measure10.com', 10);
			const json = JSON.stringify(profile);
			void json.length;
		});

		bench('measure profile size (100 requests)', () => {
			const profile = generateProfile('measure100.com', 100);
			const json = JSON.stringify(profile);
			void json.length;
		});

		bench('measure profile size (1000 requests)', () => {
			const profile = generateProfile('measure1000.com', 1000);
			const json = JSON.stringify(profile);
			void json.length;
		});

		bench('measure 100 profiles total size', () => {
			const profiles = Array.from({ length: 100 }, (_, i) =>
				generateProfile(`example${i}.com`, 50),
			);
			const json = JSON.stringify(profiles);
			void json.length;
		});
	});
});
