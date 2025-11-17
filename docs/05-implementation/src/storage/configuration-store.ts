/**
 * @file docs/05-implementation/src/storage/configuration-store.ts
 * @implements 04-algorithms/main-workflow.md#config-load
 * @spec specs/configuration.spec.md
 * @uses api/configuration.api.md
 * @description
 * Persistent storage for global configuration using chrome.storage.sync.
 * Supports hot-reload, validation, and user preferences.
 * Used by all calculators and aggregators for feature flags and thresholds.
 */

import type { Configuration } from '../../api/configuration.api.md';

const STORAGE_KEY = 'dns-sentinel-config';

/**
 * Loads configuration with defaults and validation.
 * Uses sync storage for cross-device sync (user preferences only).
 */
export async function getConfig(): Promise<Configuration> {
	try {
		const data = await chrome.storage.sync.get(STORAGE_KEY);
		const stored = data[STORAGE_KEY] as Partial<Configuration> | undefined;

		// Merge with defaults
		const config: Configuration = {
			enabled: stored?.enabled ?? true,
			sensitivity: stored?.sensitivity ?? 'balanced',
			privacy: {
				collectStatistics: stored?.privacy?.collectStatistics ?? false,
				allowTelemetry: stored?.privacy?.allowTelemetry ?? false,
			},
			thresholds: {
				critical: stored?.thresholds?.critical ?? 0.80,
				high: stored?.thresholds?.high ?? 0.60,
				medium: stored?.thresholds?.medium ?? 0.40,
			},
			weights: {
				M1: stored?.weights?.M1 ?? 0.15,
				M2: stored?.weights?.M2 ?? 0.25,
				M3: stored?.weights?.M3 ?? 0.40,
				M4: stored?.weights?.M4 ?? 0.20,
			},
			groups: {
				rate: { enabled: stored?.groups?.rate?.enabled ?? true, weight: 0.15 },
				entropy: { enabled: stored?.groups?.entropy?.enabled ?? true, weight: 0.25 },
				reputation: { enabled: stored?.groups?.reputation?.enabled ?? true, weight: 0.40 },
				behavior: { enabled: stored?.groups?.behavior?.enabled ?? true, weight: 0.20 },
			},
			storage: {
				enabled: stored?.storage?.enabled ?? true,
				maxProfiles: stored?.storage?.maxProfiles ?? 10000,
			},
		};

		// Validate weights sum to 1.0 (tolerance 0.01)
		const sum = config.weights.M1 + config.weights.M2 + config.weights.M3 + config.weights.M4;
		if (Math.abs(sum - 1.0) > 0.01) {
			console.warn('[Config] Weights sum invalid, normalizing:', sum);
			// Normalize
			const factor = 1.0 / sum;
			config.weights.M1 *= factor;
			config.weights.M2 *= factor;
			config.weights.M3 *= factor;
			config.weights.M4 *= factor;
		}

		// Validate thresholds
		config.thresholds.critical = clamp(config.thresholds.critical, 0.5, 1.0);
		config.thresholds.high = clamp(config.thresholds.high, 0.3, config.thresholds.critical - 0.05);
		config.thresholds.medium = clamp(config.thresholds.medium, 0.1, config.thresholds.high - 0.05);

		return config;
	} catch (error) {
		console.error('[Config] Load failed:', error);
		// Fallback to minimal safe config
		return {
			enabled: true,
			sensitivity: 'balanced',
			privacy: { collectStatistics: false, allowTelemetry: false },
			thresholds: { critical: 0.80, high: 0.60, medium: 0.40 },
			weights: { M1: 0.15, M2: 0.25, M3: 0.40, M4: 0.20 },
			groups: {
				rate: { enabled: true, weight: 0.15 },
				entropy: { enabled: true, weight: 0.25 },
				reputation: { enabled: true, weight: 0.40 },
				behavior: { enabled: true, weight: 0.20 },
			},
			storage: { enabled: true, maxProfiles: 10000 },
		};
	}
}

/**
 * Saves user configuration (sync storage for cross-device).
 * Validates before saving to prevent invalid state.
 */
export async function saveConfig(config: Partial<Configuration>): Promise<void> {
	try {
		const current = await getConfig();
		const newConfig: Configuration = { ...current, ...config };

		// Re-validate after merge
		const sum = newConfig.weights.M1 + newConfig.weights.M2 + newConfig.weights.M3 + newConfig.weights.M4;
		if (Math.abs(sum - 1.0) > 0.01) {
			throw new Error('Weights must sum to 1.0');
		}

		if (newConfig.thresholds.critical <= newConfig.thresholds.high) {
			throw new Error('Critical threshold must be > high');
		}

		await chrome.storage.sync.set({ [STORAGE_KEY]: newConfig });

		// Notify listeners (for hot-reload)
		chrome.runtime.sendMessage({ type: 'CONFIG_UPDATED', config: newConfig });
	} catch (error) {
		console.error('[Config] Save failed:', error);
		throw error;
	}
}

/**
 * Resets configuration to factory defaults.
 */
export async function resetConfig(): Promise<void> {
	await chrome.storage.sync.remove(STORAGE_KEY);
	// Trigger reload
	chrome.runtime.reload();
}

/**
 * Clamps value to [min, max] (utility for thresholds).
 */
function clamp(value: number, min: number, max: number): number {
	return Math.max(min, Math.min(max, value));
}