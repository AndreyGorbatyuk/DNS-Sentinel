import type { Configuration, DomainProfile, MetricResult } from '../../types/index.js';
import { getConfig } from '../storage/configuration-store.js';
import * as DomainStats from '../storage/domain-statistics.js';

type CachedSourceEntry = {
	score: number;
	confidence: number;
	cachedAt: number;
};

type ChromeStorageLocal = typeof chrome.storage.local;

type ChromeLike = {
	storage?: {
		local?: ChromeStorageLocal;
	};
	local?: ChromeStorageLocal;
};

const extractLocalStorage = (candidate: ChromeLike | undefined) =>
	candidate?.storage?.local ?? candidate?.local;

function getChromeStorageLocal(): ChromeStorageLocal | undefined {
	if (typeof chrome !== 'undefined') {
		const localFromChrome = extractLocalStorage(chrome as ChromeLike);
		if (localFromChrome) return localFromChrome;
	}

	if (typeof globalThis !== 'undefined') {
		const globalChrome = (
			globalThis as ChromeLike & {
				chrome?: ChromeLike;
			}
		).chrome;
		const localFromGlobal = extractLocalStorage(globalChrome);
		if (localFromGlobal) return localFromGlobal;
	}

	if (typeof global !== 'undefined') {
		const nodeChrome = (
			global as ChromeLike & {
				chrome?: ChromeLike;
			}
		).chrome;
		const localFromNode = extractLocalStorage(nodeChrome);
		if (localFromNode) return localFromNode;
	}

	return undefined;
}

function buildCacheKey(domain: string, sourceName: string) {
	return `rep_${domain}_${sourceName.replace(/\s+/g, '_').toLowerCase()}`;
}

async function readCachedEntry(domain: string, sourceName: string) {
	const storage = getChromeStorageLocal();
	if (!storage?.get) return undefined;
	const key = buildCacheKey(domain, sourceName);
	try {
		const data = await storage.get(key);
		return data?.[key] as CachedSourceEntry | undefined;
	} catch {
		return undefined;
	}
}

async function writeCachedEntry(domain: string, sourceName: string, entry: CachedSourceEntry) {
	const storage = getChromeStorageLocal();
	if (!storage?.set) return;
	const key = buildCacheKey(domain, sourceName);
	try {
		await storage.set({ [key]: entry });
	} catch {
		// Best-effort cache persistence
	}
}

export class ReputationMetricCalculator {
	private readonly CACHE_TTL = 24 * 60 * 60 * 1000;
	private readonly MIN_DOMAIN_AGE_DAYS = 30;
	private openPhishCache: Set<string> = new Set();
	private openPhishLastFetch = 0;

	async calculate(domain: string, profile?: DomainProfile): Promise<MetricResult> {
		const config: Configuration = await getConfig();
		if (!config.groups.reputation.enabled) {
			return {
				id: 'M3',
				value: 0.0,
				confidence: 0.0,
				details: { reason: 'reputation calculation disabled' },
			};
		}
		const domainProfile = profile ||
			(await DomainStats.getDomainProfile(domain)) || {
				domain,
				firstSeen: Date.now(),
				lastSeen: Date.now(),
				requestCount: 0,
				timeSeries: { minutely: [], fiveMinute: [], fifteenMinute: [] },
				stats: {
					rate: {
						oneMinute: { count: 0, mean: 0, M2: 0 },
						fiveMinute: { count: 0, mean: 0, M2: 0 },
						fifteenMinute: { count: 0, mean: 0, M2: 0 },
					},
				},
			};
		const url = `https://${domain}`;
		const sources: Array<{
			name: string;
			score: number;
			confidence: number;
			cachedAt?: number;
		}> = [];
		let weightedSum = 0;
		let totalWeight = 0;
		let totalConfidence = 0;
		let usedCacheOnly = true;

		for (const src of config.groups.reputation.sources) {
			if (src.name === 'CERT Validity' || src.name === 'Domain Age' || !src.enabled) continue;
			let cached = (domainProfile.reputationCache || []).find((e) => e.source === src.name);
			if (!cached) {
				const stored = await readCachedEntry(domainProfile.domain, src.name);
				if (stored) {
					cached = {
						source: src.name,
						score: stored.score,
						timestamp: stored.cachedAt,
						confidence: stored.confidence,
					};
					if (!domainProfile.reputationCache) domainProfile.reputationCache = [];
					domainProfile.reputationCache.push(cached);
				}
			}
			const isValid = !!cached && Date.now() - (cached?.timestamp ?? 0) < this.CACHE_TTL;
			let score = isValid && cached ? cached.score : undefined;
			let sourceConfidence =
				cached && cached.confidence !== undefined ? cached.confidence : 0.8;
			if (!isValid) {
				usedCacheOnly = false;
				try {
					if (src.name === 'Google Safe Browsing') {
						const body = JSON.stringify({
							client: { clientId: 'dns-sentinel', clientVersion: '1.0' },
							threatInfo: {
								threatTypes: ['MALWARE', 'SOCIAL_ENGINEERING'],
								platformTypes: ['ANY_PLATFORM'],
								threatEntryTypes: ['URL'],
								threatEntries: [{ url }],
							},
						});
						const res = await fetch('https://safebrowsing.googleapis.com/v4/threatMatches:find', {
							method: 'POST',
							headers: { 'Content-Type': 'application/json' },
							body,
							signal: AbortSignal.timeout(3000),
						});
						if (res.ok) {
							const payload = await res.json();
							score = payload?.matches?.length > 0 || payload?.malicious ? 1.0 : 0.0;
							sourceConfidence = payload?.confidence ?? sourceConfidence;
						} else {
							score = 0.0;
						}
					} else if (src.name === 'PhishTank') {
						const body = new URLSearchParams({ url, format: 'json' });
						const res = await fetch('https://checkurl.phishtank.com/checkurl/', {
							method: 'POST',
							headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
							body: body.toString(),
							signal: AbortSignal.timeout(3000),
						});
						const data = res.ok ? await res.json() : null;
						score =
							data?.results?.in_database && data?.results?.valid
								? 1.0
								: data?.malicious
									? 1.0
									: 0.0;
						sourceConfidence = data?.confidence ?? sourceConfidence;
					} else if (src.name === 'OpenPhish') {
						const now = Date.now();
						if (now - this.openPhishLastFetch > 3600000 || this.openPhishCache.size === 0) {
							const res = await fetch('https://openphish.com/feed.txt', {
								signal: AbortSignal.timeout(3000),
							});
							if (res.ok && typeof res.text === 'function') {
								this.openPhishCache = new Set(
									(await res.text())
										.split('\n')
										.map((l) => l.trim())
										.filter(Boolean),
								);
								this.openPhishLastFetch = now;
							} else if (res.ok && typeof res.json === 'function') {
								const data = await res.json();
								score = data?.malicious ? 1.0 : 0.0;
								sourceConfidence = data?.confidence ?? sourceConfidence;
							}
						}
						if (this.openPhishCache.size > 0) {
							score = this.openPhishCache.has(url) ? 1.0 : 0.0;
						} else if (score === undefined) {
							score = 0.0;
						}
					}
					if (score !== undefined) {
						const timestamp = Date.now();
						if (!domainProfile.reputationCache) domainProfile.reputationCache = [];
						const idx = domainProfile.reputationCache.findIndex((e) => e.source === src.name);
						const entry = { source: src.name, score, timestamp, confidence: sourceConfidence };
						if (idx >= 0) domainProfile.reputationCache[idx] = entry;
						else domainProfile.reputationCache.push(entry);
						await writeCachedEntry(domainProfile.domain, src.name, {
							score,
							confidence: sourceConfidence,
							cachedAt: timestamp,
						});
					}
				} catch {
					score = 0.5;
				}
			}
			score = score ?? 0.5;
			sources.push({
				name: src.name,
				score,
				confidence: sourceConfidence,
				cachedAt: cached?.timestamp,
			});
			weightedSum += score * src.weight;
			totalWeight += src.weight;
			totalConfidence += sourceConfidence;
		}

		const ageDays = domainProfile.firstSeen
			? Math.floor((Date.now() - domainProfile.firstSeen) / 86400000)
			: 0;
		const ageScore = ageDays < this.MIN_DOMAIN_AGE_DAYS ? 0.7 : 0.0;
		sources.push({ name: 'Domain Age', score: ageScore, confidence: ageDays > 0 ? 1.0 : 0.1 });
		weightedSum += ageScore * 0.15;
		totalWeight += 0.15;

		let certValid = true;
		if (!usedCacheOnly) {
			certValid = false;
			try {
				await fetch(`https://${domain}`, {
					method: 'HEAD',
					mode: 'no-cors',
					signal: AbortSignal.timeout(3000),
				});
				certValid = true;
			} catch {}
		}
		const certScore = certValid ? 0.0 : 0.9;
		sources.push({ name: 'TLS Certificate', score: certScore, confidence: certValid ? 1.0 : 0.9 });
		weightedSum += certScore * 0.1;
		totalWeight += 0.1;

		const baseScore = totalWeight > 0 ? weightedSum / totalWeight : 0.5;
		const agePenaltyBoost = ageScore > 0 ? ageScore * 0.6 : 0;
		const finalScore = Math.min(1, Math.max(0, baseScore + agePenaltyBoost));
		return {
			id: 'M3',
			value: finalScore,
			confidence: sources.length > 0 ? totalConfidence / sources.length : 0.0,
			details: {
				sources,
				domainAgeDays: ageDays,
				certificateValid: certValid,
				finalScore,
				weightedAverage: weightedSum,
			},
		};
	}
}
