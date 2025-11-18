/**
 * @file docs/05-implementation/src/storage/configuration-store.ts
 * @implements 04-algorithms/main-workflow.md#config-load
 * @spec specs/configuration.spec.md
 * @uses api/configuration.api.md
 * @description
 * Configuration storage layer for pure documentation stage.
 * All chrome.* calls are wrapped in a safe stub that works in plain TypeScript.
 * When you create a real extension → just delete the stub (lines 15–38).
 */

/// <reference no-default-lib="true"/>
/// <reference lib="es2022" />
/// <reference lib="webworker" />
/// <reference path="../../../chrome-stubs.ts" />


import type { Configuration } from '../../../types.ts';

const STORAGE_KEY = 'dns-sentinel-config';

/**
 * Loads configuration with defaults and validation.
 * Works both in real extension and in pure documentation.
 */
export async function getConfig(): Promise<Configuration> {
	try {
		const data = await chrome.storage.sync.get(STORAGE_KEY);
		const stored = data[STORAGE_KEY] as Partial<Configuration> | undefined;

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
				reputation: {
					enabled: stored?.groups?.reputation?.enabled ?? true,
					weight: 0.40,
					cacheTTL: stored?.groups?.reputation?.cacheTTL ?? 24,
					sources: stored?.groups?.reputation?.sources ?? [
						{ name: 'Google Safe Browsing', enabled: true, weight: 0.4 },
						{ name: 'PhishTank', enabled: true, weight: 0.3 },
						{ name: 'OpenPhish', enabled: true, weight: 0.2 },
						{ name: 'CERT Validity', enabled: true, weight: 0.1 },
					],
				},
				behavior: {
					enabled: stored?.groups?.behavior?.enabled ?? true,
					weight: 0.20,
					minHistoryRequests: stored?.groups?.behavior?.minHistoryRequests ?? 5,
					minHistoryDays: stored?.groups?.behavior?.minHistoryDays ?? 1,
				},
			},
			storage: {
				enabled: stored?.storage?.enabled ?? true,
				maxProfiles: stored?.storage?.maxProfiles ?? 10000,
			},
		};

		// Validation & normalization (same as before)
		const sum = config.weights.M1 + config.weights.M2 + config.weights.M3 + config.weights.M4;
		if (Math.abs(sum - 1.0) > 0.01) {
			const factor = 1.0 / sum;
			config.weights.M1 *= factor;
			config.weights.M2 *= factor;
			config.weights.M3 *= factor;
			config.weights.M4 *= factor;
		}

		return config;
	} catch {
		// Absolute fallback
		return {
			enabled: true,
			sensitivity: 'balanced',
			privacy: { collectStatistics: false, allowTelemetry: false },
			thresholds: { critical: 0.80, high: 0.60, medium: 0.40 },
			weights: { M1: 0.15, M2: 0.25, M3: 0.40, M4: 0.20 },
			groups: {
				rate: { enabled: true, weight: 0.15 },
				entropy: { enabled: true, weight: 0.25 },
				reputation: {
					enabled: true,
					weight: 0.40,
					cacheTTL: 24,
					sources: [
						{ name: 'Google Safe Browsing', enabled: true, weight: 0.4 },
						{ name: 'PhishTank', enabled: true, weight: 0.3 },
						{ name: 'OpenPhish', enabled: true, weight: 0.2 },
						{ name: 'CERT Validity', enabled: true, weight: 0.1 },
					],
				},
				behavior: {
					enabled: true,
					weight: 0.20,
					minHistoryRequests: 5,
					minHistoryDays: 1,
				},
			},
			storage: { enabled: true, maxProfiles: 10000 },
		};
	}
}

/**
 * Stub functions — they do nothing in documentation mode.
 * Will be replaced automatically when real chrome API appears.
 */
export async function saveConfig(_config: Partial<Configuration>): Promise<void> {
	// No-op in docs mode
}

export async function resetConfig(): Promise<void> {
	// No-op in docs mode
}