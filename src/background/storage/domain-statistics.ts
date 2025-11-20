import type { DomainProfile, Configuration } from '../../types/index.ts';
import { getConfig } from './configuration-store.ts';

const STORAGE_KEYS = {
	profile(domain: string): string {
		return `profile_${domain}`;
	},
	metadata(domain: string): string {
		return `meta_${domain}`;
	},
};

export class DomainStatistics {
	private static readonly MAX_PROFILES = 10_000;
	private static readonly PROFILE_TTL_DAYS = 90;
	private static readonly BATCH_SIZE = 50;

	static async getDomainProfile(domain: string): Promise<DomainProfile | null> {
		try {
			const key = STORAGE_KEYS.profile(domain);
			const data = await chrome.storage.local.get(key);
			const profile = data[key] as DomainProfile | undefined;

			if (!profile) return null;

			const ageDays = (Date.now() - profile.lastSeen) / (24 * 60 * 60 * 1000);
			if (ageDays > this.PROFILE_TTL_DAYS) {
				await this.removeDomainProfile(domain);
				return null;
			}

			return profile;
		} catch (error) {
			console.warn(`[DomainStatistics] Failed to get profile for ${domain}:`, error);
			return null;
		}
	}

	static async updateDomainProfile(domain: string, profile: DomainProfile): Promise<void> {
		try {
			const config: Configuration = await getConfig();
			if (!config.storage.enabled) return;

			const key = STORAGE_KEYS.profile(domain);
			const metaKey = STORAGE_KEYS.metadata(domain);

			const batch: Record<string, any> = {
				[key]: {
					...profile,
					_version: (profile._version || 0) + 1,
					_updatedAt: Date.now(),
				},
				[metaKey]: {
					domain,
					size: JSON.stringify(profile).length,
					lastAccess: Date.now(),
				},
			};

			await this.enforceStorageLimits();

			await chrome.storage.local.set(batch);
		} catch (error) {
			console.error(`[DomainStatistics] Failed to update profile for ${domain}:`, error);
		}
	}

	static async removeDomainProfile(domain: string): Promise<void> {
		try {
			const keys = [
				STORAGE_KEYS.profile(domain),
				STORAGE_KEYS.metadata(domain),
			];
			await chrome.storage.local.remove(keys);
		} catch (error) {
			console.warn(`[DomainStatistics] Failed to remove profile for ${domain}:`, error);
		}
	}

	private static async enforceStorageLimits(): Promise<void> {
		try {
			const all = await chrome.storage.local.get(null);
			const profileEntries = Object.entries(all).filter(([k]) => k.startsWith('profile_'));

			if (profileEntries.length <= this.MAX_PROFILES) return;

			const sorted = profileEntries
				.map(([key, value]) => ({
					key,
					profile: value as DomainProfile,
					meta: all[STORAGE_KEYS.metadata(key.replace('profile_', ''))] || {},
				}))
				.sort((a, b) => (a.meta.lastAccess || 0) - (b.meta.lastAccess || 0));

			const toRemove = sorted.slice(0, Math.floor(sorted.length * 0.2));
			const removeKeys = toRemove.flatMap((e) => [
				e.key,
				STORAGE_KEYS.metadata(e.key.replace('profile_', '')),
			]);

			await chrome.storage.local.remove(removeKeys);
		} catch (error) {
			console.error('[DomainStatistics] Storage cleanup failed:', error);
		}
	}

	static createInitialProfile(domain: string, timestamp: number): DomainProfile {
		return {
			domain,
			firstSeen: timestamp,
			lastSeen: timestamp,
			requestCount: 0,
			timeSeries: {
				minutely: [],
				fiveMinute: [],
				fifteenMinute: [],
			},
			accessHours: Array(24).fill(0),
			dayFrequencies: Array(7).fill(0),
			typicalReferrers: [],
			directAccessToSensitive: false,
			riskHistory: [],
			stats: {
				rate: {
					oneMinute: { count: 0, mean: 0, M2: 0 },
					fiveMinute: { count: 0, mean: 0, M2: 0 },
					fifteenMinute: { count: 0, mean: 0, M2: 0 },
				},
				interArrival: { count: 0, mean: 0, M2: 0 },
			},
			_version: 1,
			_updatedAt: timestamp,
		};
	}

	static appendToTimeSeries(series: number[], timestamp: number, maxSize = 120): void {
		series.push(timestamp);
		if (series.length > maxSize) {
			series.shift();
		}
	}

	static pruneTimeSeries(series: number[], windowSec: number): void {
		const cutoff = Date.now() - windowSec * 1000;
		while (series.length > 0 && series[0] < cutoff) {
			series.shift();
		}
	}
}

export const getDomainProfile = DomainStatistics.getDomainProfile.bind(DomainStatistics);
export const updateDomainProfile = DomainStatistics.updateDomainProfile.bind(DomainStatistics);
export const createInitialProfile = DomainStatistics.createInitialProfile;
export const appendToTimeSeries = DomainStatistics.appendToTimeSeries;

