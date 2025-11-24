import type { Configuration, DomainProfile, MetricResult } from '../../types/index.js';
import { getConfig } from '../storage/configuration-store.js';
import { getDomainProfile } from '../storage/domain-statistics.js';

interface ReputationSource {
	name: string;
	score: number;
	confidence: number;
	cachedAt?: number;
}

interface ReputationDetails {
	sources: ReputationSource[];
	domainAgeDays: number;
	certificateValid: boolean;
	finalScore: number;
	weightedAverage: number;
}

export class ReputationMetricCalculator {
	private readonly CACHE_TTL = 24 * 60 * 60 * 1000;
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

		const domainProfile = profile || (await getDomainProfile(domain));
		const now = Date.now();

		const sources: ReputationSource[] = [];
		let weightedSum = 0;
		let totalWeight = 0;
		let totalConfidence = 0;

		for (const src of this.REPUTATION_SOURCES.slice(0, -1)) {
			const cached = await this.getCachedReputation(domain, src.name);
			const score = cached ? cached.score : await this.queryReputationAPI(domain, src.name);
			const confidence = cached ? cached.confidence : 0.8;

			sources.push({ name: src.name, score, confidence, cachedAt: cached?.cachedAt });
			weightedSum += score * src.weight;
			totalWeight += src.weight;
			totalConfidence += confidence;
		}

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

		const certValid = await this.checkCertificate(domain);
		const certScore = certValid ? 0.0 : 0.9;
		sources.push({
			name: 'TLS Certificate',
			score: certScore,
			confidence: certValid ? 1.0 : 0.9,
		});
		weightedSum += certScore * 0.1;
		totalWeight += 0.1;

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

	private async getCachedReputation(
		domain: string,
		source: string,
	): Promise<ReputationSource | null> {
		try {
			const key = `rep_${domain}_${source}`;
			const data = await chrome.storage.local.get(key);
			const cached = data[key];
			if (cached?.cachedAt && Date.now() - cached.cachedAt < this.CACHE_TTL) {
				return cached;
			}
		} catch {
			// Ignore cache errors
		}
		return null;
	}

	private async queryReputationAPI(domain: string, source: string): Promise<number> {
		try {
			const response = await fetch(
				`https://api.reputation.example/${source}/check?domain=${domain}`,
				{
					signal: AbortSignal.timeout(3000),
				},
			);
			const result = await response.json();
			const score = result.malicious ? 1.0 : 0.0;

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
			return 0.5;
		}
	}

	private async checkCertificate(domain: string): Promise<boolean> {
		try {
			const response = await fetch(`https://${domain}`, { method: 'HEAD', mode: 'no-cors' });
			return true;
		} catch {
			return false;
		}
	}
}
