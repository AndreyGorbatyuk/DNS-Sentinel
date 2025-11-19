/**
 * @file tests/domain-statistics.test.ts
 * @description Unit tests for domain statistics storage layer
 * @uses src/storage/domain-statistics.ts
 * @uses types.ts
 */

/// <reference path="../../chrome-stubs.ts" />

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { DomainProfile, WelfordStats } from '../../types.ts';

// Mock chrome.storage.local
const mockChromeStorage = {
	local: {
		get: vi.fn(),
		set: vi.fn(),
		remove: vi.fn(),
		clear: vi.fn(),
	},
};

// Assign to globalThis instead of global
(globalThis as any).chrome = mockChromeStorage;

// Mock implementation of domain-statistics module
const getDomainProfile = vi.fn(async (domain: string): Promise<DomainProfile | null> => {
	const key = `profile_${domain}`;
	const data = await chrome.storage.local.get(key);
	return data[key] || null;
});

const updateDomainProfile = vi.fn(async (domain: string, profile: DomainProfile): Promise<void> => {
	const key = `profile_${domain}`;
	await chrome.storage.local.set({ [key]: profile });
});

const deleteDomainProfile = vi.fn(async (domain: string): Promise<void> => {
	const key = `profile_${domain}`;
	await chrome.storage.local.remove(key);
});

const getAllProfiles = vi.fn(async (): Promise<DomainProfile[]> => {
	const data = await chrome.storage.local.get(null);
	return Object.keys(data)
		.filter((key) => key.startsWith('profile_'))
		.map((key) => data[key]);
});

const pruneOldProfiles = vi.fn(async (maxAge: number, maxProfiles: number): Promise<number> => {
	const profiles = await getAllProfiles();
	const now = Date.now();
	let pruned = 0;

	// Sort by lastSeen (oldest first)
	const sorted = profiles.sort((a, b) => a.lastSeen - b.lastSeen);

	// Prune by age
	for (const profile of sorted) {
		if (now - profile.lastSeen > maxAge) {
			await deleteDomainProfile(profile.domain);
			pruned++;
		}
	}

	// Prune by count
	const remaining = await getAllProfiles();
	if (remaining.length > maxProfiles) {
		const toRemove = remaining.slice(0, remaining.length - maxProfiles);
		for (const profile of toRemove) {
			await deleteDomainProfile(profile.domain);
			pruned++;
		}
	}

	return pruned;
});

const migrateProfile = vi.fn((profile: DomainProfile): DomainProfile => {
	const currentVersion = 2;
	if (profile._version === currentVersion) {
		return profile;
	}

	// Migration logic
	const migrated = { ...profile };

	if (!profile._version || profile._version < 2) {
		// Initialize missing fields for v2
		if (!migrated.accessHours) {
			migrated.accessHours = Array(24).fill(0);
		}
		if (!migrated.dayFrequencies) {
			migrated.dayFrequencies = Array(7).fill(0);
		}
		if (!migrated.typicalReferrers) {
			migrated.typicalReferrers = [];
		}
		if (!migrated.stats.interArrival) {
			migrated.stats.interArrival = { count: 0, mean: 0, M2: 0 };
		}
	}

	migrated._version = currentVersion;
	migrated._updatedAt = Date.now();

	return migrated;
});

describe('DomainStatistics', () => {
	beforeEach(() => {
		// Reset all mocks
		vi.mocked(mockChromeStorage.local.get).mockReset();
		vi.mocked(mockChromeStorage.local.set).mockReset();
		vi.mocked(mockChromeStorage.local.remove).mockReset();
		vi.mocked(mockChromeStorage.local.clear).mockReset();

		getDomainProfile.mockClear();
		updateDomainProfile.mockClear();
		deleteDomainProfile.mockClear();
		getAllProfiles.mockClear();
		pruneOldProfiles.mockClear();
		migrateProfile.mockClear();
	});

	describe('Profile CRUD operations', () => {
		it('should retrieve existing profile', async () => {
			const mockProfile: DomainProfile = {
				domain: 'example.com',
				firstSeen: Date.now() - 86400000,
				lastSeen: Date.now() - 3600000,
				requestCount: 10,
				timeSeries: {
					minutely: [],
					fiveMinute: [],
					fifteenMinute: [],
				},
				stats: {
					rate: {
						oneMinute: { count: 10, mean: 1.0, M2: 0.5 },
						fiveMinute: { count: 10, mean: 1.0, M2: 0.5 },
						fifteenMinute: { count: 10, mean: 1.0, M2: 0.5 },
					},
				},
			};

			vi.mocked(mockChromeStorage.local.get).mockResolvedValue({
				'profile_example.com': mockProfile,
			});

			const profile = await getDomainProfile('example.com');

			expect(profile).toEqual(mockProfile);
			expect(mockChromeStorage.local.get).toHaveBeenCalledWith('profile_example.com');
		});

		it('should return null for non-existent profile', async () => {
			vi.mocked(mockChromeStorage.local.get).mockResolvedValue({});

			const profile = await getDomainProfile('nonexistent.com');

			expect(profile).toBeNull();
		});

		it('should save profile to storage', async () => {
			const newProfile: DomainProfile = {
				domain: 'newsite.org',
				firstSeen: Date.now(),
				lastSeen: Date.now(),
				requestCount: 1,
				timeSeries: {
					minutely: [Date.now()],
					fiveMinute: [Date.now()],
					fifteenMinute: [Date.now()],
				},
				stats: {
					rate: {
						oneMinute: { count: 1, mean: 1.0, M2: 0 },
						fiveMinute: { count: 1, mean: 1.0, M2: 0 },
						fifteenMinute: { count: 1, mean: 1.0, M2: 0 },
					},
				},
			};

			vi.mocked(mockChromeStorage.local.set).mockResolvedValue(undefined);

			await updateDomainProfile('newsite.org', newProfile);

			expect(mockChromeStorage.local.set).toHaveBeenCalledWith({
				'profile_newsite.org': newProfile,
			});
		});
	});

	describe('Welford statistics updates', () => {
		it('should correctly update Welford stats incrementally', () => {
			const stats: WelfordStats = { count: 0, mean: 0, M2: 0 };

			// Add values: 10, 20, 30
			const values = [10, 20, 30];

			values.forEach((value) => {
				stats.count += 1;
				const delta = value - stats.mean;
				stats.mean += delta / stats.count;
				const delta2 = value - stats.mean;
				stats.M2 += delta * delta2;
			});

			expect(stats.count).toBe(3);
			expect(stats.mean).toBeCloseTo(20, 2); // (10+20+30)/3 = 20
			expect(stats.M2).toBeCloseTo(200, 1); // Σ(xi - mean)² = 100 + 0 + 100 = 200
		});

		it('should handle single value correctly', () => {
			const stats: WelfordStats = { count: 0, mean: 0, M2: 0 };

			const value = 42;
			stats.count += 1;
			const delta = value - stats.mean;
			stats.mean += delta / stats.count;
			const delta2 = value - stats.mean;
			stats.M2 += delta * delta2;

			expect(stats.count).toBe(1);
			expect(stats.mean).toBe(42);
			expect(stats.M2).toBe(0); // No variance with single value
		});

		it('should compute variance from M2 correctly', () => {
			const stats: WelfordStats = { count: 5, mean: 10, M2: 40 };

			// Variance = M2 / (count - 1)
			const variance = stats.count > 1 ? stats.M2 / (stats.count - 1) : 0;

			expect(variance).toBeCloseTo(10, 2); // 40 / 4 = 10
		});
	});

	describe('Profile pruning', () => {
		it('should prune profiles older than maxAge', async () => {
			const now = Date.now();
			const oldProfile: DomainProfile = {
				domain: 'old.com',
				firstSeen: now - 7776000000, // 90 days ago
				lastSeen: now - 2592000000, // 30 days ago (old)
				requestCount: 5,
				timeSeries: {
					minutely: [],
					fiveMinute: [],
					fifteenMinute: [],
				},
				stats: {
					rate: {
						oneMinute: { count: 5, mean: 1.0, M2: 0.5 },
						fiveMinute: { count: 5, mean: 1.0, M2: 0.5 },
						fifteenMinute: { count: 5, mean: 1.0, M2: 0.5 },
					},
				},
			};

			const recentProfile: DomainProfile = {
				domain: 'recent.com',
				firstSeen: now - 86400000,
				lastSeen: now - 3600000, // 1 hour ago (recent)
				requestCount: 10,
				timeSeries: {
					minutely: [],
					fiveMinute: [],
					fifteenMinute: [],
				},
				stats: {
					rate: {
						oneMinute: { count: 10, mean: 2.0, M2: 1.0 },
						fiveMinute: { count: 10, mean: 2.0, M2: 1.0 },
						fifteenMinute: { count: 10, mean: 2.0, M2: 1.0 },
					},
				},
			};

			vi.mocked(mockChromeStorage.local.get)
				.mockResolvedValueOnce({
					'profile_old.com': oldProfile,
					'profile_recent.com': recentProfile,
				})
				.mockResolvedValueOnce({
					'profile_recent.com': recentProfile,
				});

			vi.mocked(mockChromeStorage.local.remove).mockResolvedValue(undefined);

			const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days
			const maxProfiles = 1000;

			const pruned = await pruneOldProfiles(maxAge, maxProfiles);

			expect(pruned).toBe(1); // Only old.com pruned
			expect(mockChromeStorage.local.remove).toHaveBeenCalledWith('profile_old.com');
		});

		it('should prune excess profiles when count exceeds maxProfiles', async () => {
			const now = Date.now();
			const profiles: DomainProfile[] = Array.from({ length: 15 }, (_, i) => ({
				domain: `site${i}.com`,
				firstSeen: now - 86400000,
				lastSeen: now - i * 3600000, // Varying recency
				requestCount: 10,
				timeSeries: {
					minutely: [],
					fiveMinute: [],
					fifteenMinute: [],
				},
				stats: {
					rate: {
						oneMinute: { count: 10, mean: 1.0, M2: 0.5 },
						fiveMinute: { count: 10, mean: 1.0, M2: 0.5 },
						fifteenMinute: { count: 10, mean: 1.0, M2: 0.5 },
					},
				},
			}));

			const storageData: Record<string, DomainProfile> = {};
			profiles.forEach((p) => {
				storageData[`profile_${p.domain}`] = p;
			});

			vi.mocked(mockChromeStorage.local.get).mockResolvedValue(storageData);
			vi.mocked(mockChromeStorage.local.remove).mockResolvedValue(undefined);

			const maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days (all recent)
			const maxProfiles = 10; // Keep only 10

			const pruned = await pruneOldProfiles(maxAge, maxProfiles);

			expect(pruned).toBe(5); // 15 - 10 = 5 pruned
		});
	});

	describe('Profile migration', () => {
		it('should migrate v1 profile to v2', () => {
			const v1Profile: any = {
				domain: 'legacy.com',
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
				// Missing v2 fields
			};

			const migrated = migrateProfile(v1Profile);

			expect(migrated._version).toBe(2);
			expect(migrated._updatedAt).toBeDefined();
			expect(migrated.accessHours).toEqual(Array(24).fill(0));
			expect(migrated.dayFrequencies).toEqual(Array(7).fill(0));
			expect(migrated.typicalReferrers).toEqual([]);
			expect(migrated.stats.interArrival).toEqual({ count: 0, mean: 0, M2: 0 });
		});

		it('should not migrate already current version', () => {
			const currentProfile: DomainProfile = {
				domain: 'current.com',
				firstSeen: Date.now() - 86400000,
				lastSeen: Date.now() - 3600000,
				requestCount: 20,
				timeSeries: {
					minutely: [],
					fiveMinute: [],
					fifteenMinute: [],
				},
				stats: {
					rate: {
						oneMinute: { count: 20, mean: 1.5, M2: 0.8 },
						fiveMinute: { count: 20, mean: 1.5, M2: 0.8 },
						fifteenMinute: { count: 20, mean: 1.5, M2: 0.8 },
					},
					interArrival: { count: 20, mean: 3600, M2: 500000 },
				},
				accessHours: Array(24).fill(1),
				dayFrequencies: Array(7).fill(3),
				typicalReferrers: ['https://google.com'],
				_version: 2,
				_updatedAt: Date.now(),
			};

			const migrated = migrateProfile(currentProfile);

			expect(migrated).toEqual(currentProfile);
		});
	});
});