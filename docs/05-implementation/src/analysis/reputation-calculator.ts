/**
 * @file docs/05-implementation/src/analysis/reputation-calculator.ts
 * @implements 04-algorithms/reputation-calculation.md
 * @spec specs/reputation.spec.md
 * @uses api/metric-result.api.md
 * @uses api/domain-profile.api.md
 * @uses api/configuration.api.md
 */
/* import type { MetricResult } from '../../api/metric-result.api.md';
import type { DomainProfile } from '../../api/domain-profile.api.md';
import type { Configuration } from '../../api/configuration.api.md'; */
/// <reference path="../../../chrome-stubs.ts" />


import type { MetricResult, DomainProfile, Configuration } from '../../../types.ts'

import { getDomainProfile } from '../storage/domain-statistics.ts';
import { getConfig } from '../storage/configuration-store.ts';

interface ReputationSource {
	name: string;
	score: number; // 0.0 = benign, 1.0 = malicious
	confidence: number; // 0.0–1.0
	cachedAt?: number;
}

interface ReputationDetails {
	sources: ReputationSource[];
	domainAgeDays: number;
	certificateValid: boolean;
	finalScore: number;
	weightedAverage: number;
}

/**
 * Calculates M3: Reputation anomaly score.
 * Combines blacklist hits, domain age, and certificate status.
 */
export class ReputationMetricCalculator {
	private readonly CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours
	private readonly MIN_DOMAIN_AGE_DAYS = 30;
	private readonly REPUTATION_SOURCES = [
		{ name: 'Google Safe Browsing', weight: 0.4 },
		{ name: 'PhishTank', weight: 0.3 },
		{ name: 'OpenPhish', weight: 0.2 },
		{ name: 'CERT Validity', weight: 0.1 },
	];

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

		// Use provided profile or fetch from storage
		const domainProfile = profile || (await getDomainProfile(domain));
		const now = Date.now();

		const sources: ReputationSource[] = [];
		let weightedSum = 0;
		let totalWeight = 0;
		let totalConfidence = 0;

		// 1. Blacklist checks (cached)
		for (const src of this.REPUTATION_SOURCES.slice(0, -1)) {
			const cached = await this.getCachedReputation(domain, src.name);
			const score = cached ? cached.score : await this.queryReputationAPI(domain, src.name);
			const confidence = cached ? cached.confidence : 0.8;

			sources.push({ name: src.name, score, confidence, cachedAt: cached?.cachedAt });
			weightedSum += score * src.weight;
			totalWeight += src.weight;
			totalConfidence += confidence;
		}

		// 2. Domain age penalty
		const ageDays = domainProfile ? this.getDomainAgeDays(domainProfile.firstSeen) : 0;
		const ageScore = ageDays < this.MIN_DOMAIN_AGE_DAYS ? 0.7 : 0.0;
		const ageConfidence = ageDays > 0 ? 1.0 : 0.1;

		sources.push({
			name: 'Domain Age',
			score: ageScore,
			confidence: ageConfidence,
		});
		weightedSum += ageScore * 0.15;
		totalWeight += 0.15;

		// 3. Certificate validity (if applicable)
		const certValid = await this.checkCertificate(domain);
		const certScore = certValid ? 0.0 : 0.9;
		sources.push({
			name: 'TLS Certificate',
			score: certScore,
			confidence: certValid ? 1.0 : 0.9,
		});
		weightedSum += certScore * 0.1;
		totalWeight += 0.1;

		// Final normalized score
		const finalScore = totalWeight > 0 ? weightedSum / totalWeight : 0.5;
		const avgConfidence = totalConfidence / this.REPUTATION_SOURCES.length;

		const details: ReputationDetails = {
			sources,
			domainAgeDays: ageDays,
			certificateValid: certValid,
			finalScore,
			weightedAverage: weightedSum,
		};

		return {
			id: 'M3',
			value: finalScore,
			confidence: avgConfidence,
			details,
		};
	}

	private getDomainAgeDays(firstSeen: number): number {
		if (!firstSeen) return 0;
		return Math.floor((Date.now() - firstSeen) / (24 * 60 * 60 * 1000));
	}

	private async getCachedReputation(domain: string, source: string): Promise<ReputationSource | null> {
		try {
			const key = `rep_${domain}_${source}`;
			const data = await chrome.storage.local.get(key);
			const cached = data[key];
			if (cached && cached.cachedAt && Date.now() - cached.cachedAt < this.CACHE_TTL) {
				return cached;
			}
		} catch {
			// Ignore cache errors
		}
		return null;
	}

	private async queryReputationAPI(domain: string, source: string): Promise<number> {
		// Simulate API call with fallback
		try {
			// In real implementation: fetch from background via message passing
			const response = await fetch(`https://api.reputation.example/${source}/check?domain=${domain}`, {
				signal: AbortSignal.timeout(3000),
			});
			const result = await response.json();
			const score = result.malicious ? 1.0 : 0.0;

			// Cache result
			const key = `rep_${domain}_${source}`;
			await chrome.storage.local.set({
				[key]: {
					name: source,
					score,
					confidence: result.confidence || 0.8,
					cachedAt: Date.now(),
				},
			});

			return score;
		} catch {
			return 0.5; // Unknown → medium risk
		}
	}

	private async checkCertificate(domain: string): Promise<boolean> {
		try {
			// Use chrome.certificateProvider or background fetch
			const response = await fetch(`https://${domain}`, { method: 'HEAD', mode: 'no-cors' });
			// In practice: check certificate via chrome.webRequest.onSendHeaders
			return true; // Simplified
		} catch {
			return false;
		}
	}
}