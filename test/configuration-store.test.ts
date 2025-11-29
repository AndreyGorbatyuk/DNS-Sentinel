/**
 * @file tests/configuration-store.test.ts
 * @description Unit tests for configuration store
 * @uses src/background/storage/configuration-store.ts
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getConfig, saveConfig } from '../src/background/storage/configuration-store.js';
import type { Configuration } from '../src/types/index.js';
import { mockChromeStorageLocal } from './setup.js';

describe('Configuration Store', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(mockChromeStorageLocal.get).mockResolvedValue({});
		vi.mocked(mockChromeStorageLocal.set).mockResolvedValue(undefined);
	});

	describe('getConfig()', () => {
		it('should return defaults when no stored config exists', async () => {
			vi.mocked(mockChromeStorageLocal.get).mockResolvedValue({});

			const config = await getConfig();

			expect(config.enabled).toBe(true);
			expect(config.sensitivity).toBe('balanced');
			expect(config.privacy.collectStatistics).toBe(false);
			expect(config.privacy.allowTelemetry).toBe(false);
			expect(config.thresholds.critical).toBe(0.8);
			expect(config.thresholds.high).toBe(0.6);
			expect(config.thresholds.medium).toBe(0.4);
			expect(config.weights.M1).toBe(0.15);
			expect(config.weights.M2).toBe(0.25);
			expect(config.weights.M3).toBe(0.4);
			expect(config.weights.M4).toBe(0.2);
			expect(config.groups.rate.enabled).toBe(true);
			expect(config.groups.entropy.enabled).toBe(true);
			expect(config.groups.reputation.enabled).toBe(true);
			expect(config.storage.enabled).toBe(true);
			expect(config.storage.maxProfiles).toBe(10000);
			expect(config.apiKeys).toBeDefined();
			expect(config.apiKeys?.googleSafeBrowsing).toBe('');
			expect(config.apiKeys?.phishTank).toBe('');
			expect(config.apiKeys?.virusTotal).toBe('');

			expect(mockChromeStorageLocal.get).toHaveBeenCalledWith('extension_config');
		});

		it('should return defaults with empty apiKeys when stored config has no apiKeys', async () => {
			vi.mocked(mockChromeStorageLocal.get).mockResolvedValue({
				extension_config: {
					enabled: false,
					sensitivity: 'high',
				},
			});

			const config = await getConfig();

			expect(config.enabled).toBe(false);
			expect(config.sensitivity).toBe('high');
			expect(config.apiKeys).toBeDefined();
			expect(config.apiKeys?.googleSafeBrowsing).toBe('');
			expect(config.apiKeys?.phishTank).toBe('');
			expect(config.apiKeys?.virusTotal).toBe('');
		});

		it('should return stored apiKeys when present', async () => {
			vi.mocked(mockChromeStorageLocal.get).mockResolvedValue({
				extension_config: {
					apiKeys: {
						googleSafeBrowsing: 'test-key-123',
						phishTank: 'phish-key-456',
						virusTotal: 'vt-key-789',
					},
				},
			});

			const config = await getConfig();

			expect(config.apiKeys?.googleSafeBrowsing).toBe('test-key-123');
			expect(config.apiKeys?.phishTank).toBe('phish-key-456');
			expect(config.apiKeys?.virusTotal).toBe('vt-key-789');
		});
	});

	describe('saveConfig()', () => {
		it('should save full configuration and round-trip correctly', async () => {
			const fullConfig: Configuration = {
				enabled: false,
				sensitivity: 'high',
				privacy: {
					collectStatistics: true,
					allowTelemetry: true,
				},
				thresholds: {
					critical: 0.9,
					high: 0.7,
					medium: 0.5,
				},
				weights: {
					M1: 0.2,
					M2: 0.3,
					M3: 0.3,
					M4: 0.2,
				},
				groups: {
					rate: { enabled: false, weight: 0.1 },
					entropy: { enabled: true, weight: 0.2 },
					reputation: {
						enabled: true,
						weight: 0.5,
						cacheTTL: 48,
						sources: [
							{ name: 'Google Safe Browsing', enabled: true, weight: 0.5 },
							{ name: 'PhishTank', enabled: true, weight: 0.3 },
							{ name: 'OpenPhish', enabled: true, weight: 0.2 },
						],
					},
					behavior: {
						enabled: true,
						weight: 0.2,
						minHistoryRequests: 10,
						minHistoryDays: 2,
					},
				},
				storage: {
					enabled: true,
					maxProfiles: 5000,
				},
				apiKeys: {
					googleSafeBrowsing: 'saved-key-123',
					phishTank: 'saved-phish-456',
					virusTotal: 'saved-vt-789',
				},
			};

			// Mock getConfig to return defaults first, then the saved config
			vi.mocked(mockChromeStorageLocal.get)
				.mockResolvedValueOnce({}) // First call in saveConfig
				.mockResolvedValueOnce({
					extension_config: fullConfig,
				}); // Second call in getConfig test

			await saveConfig(fullConfig);

			expect(mockChromeStorageLocal.set).toHaveBeenCalledWith({
				extension_config: expect.objectContaining({
					apiKeys: {
						googleSafeBrowsing: 'saved-key-123',
						phishTank: 'saved-phish-456',
						virusTotal: 'saved-vt-789',
					},
				}),
			});

			// Verify round-trip
			const retrieved = await getConfig();
			expect(retrieved.apiKeys?.googleSafeBrowsing).toBe('saved-key-123');
			expect(retrieved.apiKeys?.phishTank).toBe('saved-phish-456');
			expect(retrieved.apiKeys?.virusTotal).toBe('saved-vt-789');
		});

		it('should merge partial updates with existing config', async () => {
			// Initial stored config
			const initialConfig = {
				extension_config: {
					enabled: true,
					sensitivity: 'balanced',
					apiKeys: {
						googleSafeBrowsing: 'existing-key',
						phishTank: 'existing-phish',
						virusTotal: '',
					},
				},
			};

			// Mock: first get returns defaults, second returns initial, third returns merged
			vi.mocked(mockChromeStorageLocal.get)
				.mockResolvedValueOnce({}) // saveConfig calls getConfig first
				.mockResolvedValueOnce(initialConfig)
				.mockResolvedValueOnce({
					extension_config: {
						...initialConfig.extension_config,
						apiKeys: {
							...initialConfig.extension_config.apiKeys,
							virusTotal: 'new-vt-key',
						},
					},
				});

			// Update only virusTotal
			await saveConfig({
				apiKeys: {
					virusTotal: 'new-vt-key',
				},
			});

			expect(mockChromeStorageLocal.set).toHaveBeenCalledWith({
				extension_config: expect.objectContaining({
					apiKeys: expect.objectContaining({
						googleSafeBrowsing: 'existing-key',
						phishTank: 'existing-phish',
						virusTotal: 'new-vt-key',
					}),
				}),
			});

			// Verify partial update preserved other keys
			const retrieved = await getConfig();
			expect(retrieved.apiKeys?.googleSafeBrowsing).toBe('existing-key');
			expect(retrieved.apiKeys?.phishTank).toBe('existing-phish');
			expect(retrieved.apiKeys?.virusTotal).toBe('new-vt-key');
		});

		it('should handle nested partial updates correctly', async () => {
			vi.mocked(mockChromeStorageLocal.get)
				.mockResolvedValueOnce({}) // saveConfig internal call
				.mockResolvedValueOnce({
					extension_config: {
						enabled: true,
						thresholds: {
							critical: 0.8,
							high: 0.6,
							medium: 0.4,
						},
						privacy: {
							collectStatistics: false,
							allowTelemetry: false,
						},
					},
				})
				.mockResolvedValueOnce({
					extension_config: {
						enabled: true,
						thresholds: {
							critical: 0.9,
							high: 0.6,
							medium: 0.4,
						},
						privacy: {
							collectStatistics: true,
							allowTelemetry: false,
						},
					},
				});

			// Update only critical threshold and collectStatistics
			await saveConfig({
				thresholds: {
					critical: 0.9,
					high: 0.6,
					medium: 0.4,
				},
				privacy: {
					collectStatistics: true,
					allowTelemetry: false,
				},
			});

			expect(mockChromeStorageLocal.set).toHaveBeenCalledWith({
				extension_config: expect.objectContaining({
					thresholds: expect.objectContaining({
						critical: 0.9,
						high: 0.6,
						medium: 0.4,
					}),
					privacy: expect.objectContaining({
						collectStatistics: true,
						allowTelemetry: false,
					}),
				}),
			});
		});

		it('should throw error when save fails', async () => {
			const error = new Error('Storage write failed');
			vi.mocked(mockChromeStorageLocal.set).mockRejectedValue(error);

			await expect(saveConfig({ enabled: false })).rejects.toThrow('Failed to save configuration');
		});
	});

	describe('chrome.storage.local mocking', () => {
		it('should use mocked chrome.storage.local.get', async () => {
			vi.mocked(mockChromeStorageLocal.get).mockResolvedValue({
				extension_config: {
					enabled: false,
				},
			});

			const config = await getConfig();

			expect(mockChromeStorageLocal.get).toHaveBeenCalledWith('extension_config');
			expect(config.enabled).toBe(false);
		});

		it('should use mocked chrome.storage.local.set', async () => {
			vi.mocked(mockChromeStorageLocal.get).mockResolvedValue({});

			await saveConfig({ enabled: false });

			expect(mockChromeStorageLocal.set).toHaveBeenCalled();
			expect(mockChromeStorageLocal.set).toHaveBeenCalledWith({
				extension_config: expect.objectContaining({
					enabled: false,
				}),
			});
		});
	});
});

