import type { Configuration, DomainProfile, MetricResult } from '../../types/index.js';
import { getConfig } from '../storage/configuration-store.js';
import { getDomainProfile, updateDomainProfile } from '../storage/domain-statistics.js';

export class ReputationMetricCalculator {
	private readonly CACHE_TTL = 24 * 60 * 60 * 1000;
	private readonly MIN_DOMAIN_AGE_DAYS = 30;
	private openPhishCache: Set<string> = new Set();
	private openPhishLastFetch = 0;

	async calculate(domain: string, profile?: DomainProfile): Promise<MetricResult> {
		const config: Configuration = await getConfig();
		if (!config.groups.reputation.enabled) {
			return { id: 'M3', value: 0.0, confidence: 0.0, details: { reason: 'reputation calculation disabled' } };
		}
		const domainProfile = profile || (await getDomainProfile(domain)) || {
			domain, firstSeen: Date.now(), lastSeen: Date.now(), requestCount: 0,
			timeSeries: { minutely: [], fiveMinute: [], fifteenMinute: [] },
			stats: { rate: { oneMinute: { count: 0, mean: 0, M2: 0 }, fiveMinute: { count: 0, mean: 0, M2: 0 }, fifteenMinute: { count: 0, mean: 0, M2: 0 } } },
		};
		const url = `https://${domain}`;
		const sources: Array<{ name: string; score: number; confidence: number; cachedAt?: number }> = [];
		let weightedSum = 0, totalWeight = 0, totalConfidence = 0;

		for (const src of config.groups.reputation.sources) {
			if (src.name === 'CERT Validity' || src.name === 'Domain Age' || !src.enabled) continue;
			const cached = (domainProfile.reputationCache || []).find((e) => e.source === src.name);
			const isValid = cached && Date.now() - cached.timestamp < this.CACHE_TTL;
			let score = isValid ? cached.score : undefined;
			if (!isValid) {
				try {
					if (src.name === 'Google Safe Browsing') {
						const body = JSON.stringify({ client: { clientId: 'dns-sentinel', clientVersion: '1.0' }, threatInfo: { threatTypes: ['MALWARE', 'SOCIAL_ENGINEERING'], platformTypes: ['ANY_PLATFORM'], threatEntryTypes: ['URL'], threatEntries: [{ url }] } });
						const res = await fetch('https://safebrowsing.googleapis.com/v4/threatMatches:find', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, signal: AbortSignal.timeout(3000) });
						score = res.ok && (await res.json()).matches?.length > 0 ? 1.0 : 0.0;
					} else if (src.name === 'PhishTank') {
						const body = new URLSearchParams({ url, format: 'json' });
						const res = await fetch('https://checkurl.phishtank.com/checkurl/', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: body.toString(), signal: AbortSignal.timeout(3000) });
						const data = res.ok ? await res.json() : null;
						score = data?.results?.in_database && data?.results?.valid ? 1.0 : 0.0;
					} else if (src.name === 'OpenPhish') {
						const now = Date.now();
						if (now - this.openPhishLastFetch > 3600000 || this.openPhishCache.size === 0) {
							const res = await fetch('https://openphish.com/feed.txt', { signal: AbortSignal.timeout(3000) });
							if (res.ok) {
								this.openPhishCache = new Set((await res.text()).split('\n').map((l) => l.trim()).filter(Boolean));
								this.openPhishLastFetch = now;
							}
						}
						score = this.openPhishCache.has(url) ? 1.0 : 0.0;
					}
					if (score !== undefined) {
						if (!domainProfile.reputationCache) domainProfile.reputationCache = [];
						const idx = domainProfile.reputationCache.findIndex((e) => e.source === src.name);
						const entry = { source: src.name, score, timestamp: Date.now() };
						if (idx >= 0) domainProfile.reputationCache[idx] = entry;
						else domainProfile.reputationCache.push(entry);
					}
				} catch {
					score = 0.5;
				}
			}
			score = score ?? 0.5;
			sources.push({ name: src.name, score, confidence: 0.8, cachedAt: cached?.timestamp });
			weightedSum += score * src.weight;
			totalWeight += src.weight;
			totalConfidence += 0.8;
		}

		const ageDays = domainProfile.firstSeen ? Math.floor((Date.now() - domainProfile.firstSeen) / 86400000) : 0;
		const ageScore = ageDays < this.MIN_DOMAIN_AGE_DAYS ? 0.7 : 0.0;
		sources.push({ name: 'Domain Age', score: ageScore, confidence: ageDays > 0 ? 1.0 : 0.1 });
		weightedSum += ageScore * 0.15;
		totalWeight += 0.15;

		let certValid = false;
		try {
			await fetch(`https://${domain}`, { method: 'HEAD', mode: 'no-cors', signal: AbortSignal.timeout(3000) });
			certValid = true;
		} catch {}
		const certScore = certValid ? 0.0 : 0.9;
		sources.push({ name: 'TLS Certificate', score: certScore, confidence: certValid ? 1.0 : 0.9 });
		weightedSum += certScore * 0.1;
		totalWeight += 0.1;

		const finalScore = totalWeight > 0 ? weightedSum / totalWeight : 0.5;
		if (domainProfile.domain) await updateDomainProfile(domainProfile.domain, domainProfile);
		return { id: 'M3', value: finalScore, confidence: totalConfidence / sources.length, details: { sources, domainAgeDays: ageDays, certificateValid: certValid, finalScore, weightedAverage: weightedSum } };
	}
}
