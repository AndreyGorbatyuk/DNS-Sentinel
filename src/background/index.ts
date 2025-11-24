import type { RequestContext } from '../types/index.js';
import { RiskAggregator } from './aggregators/risk-aggregator.js';
import { BehaviorMetricCalculator } from './analysis/behavior-calculator.js';
import { EntropyMetricCalculator } from './analysis/entropy-calculator.js';
import { RateMetricCalculator } from './analysis/rate-calculator.js';
import { ReputationMetricCalculator } from './analysis/reputation-calculator.js';
import { getConfig } from './storage/configuration-store.js';
import { getDomainProfile, updateDomainProfile } from './storage/domain-statistics.js';
import { normalizeDomain } from './utils/domains.js';

const rateCalc = new RateMetricCalculator();
const entropyCalc = new EntropyMetricCalculator();
const reputationCalc = new ReputationMetricCalculator();
const behaviorCalc = new BehaviorMetricCalculator();
const riskAgg = new RiskAggregator();

chrome.webRequest.onBeforeRequest.addListener(
	async (details) => {
		const config = await getConfig();
		if (!config.enabled) return;

		const domain = normalizeDomain(details.url);
		if (!domain || domain === 'localhost') return;

		const context: RequestContext = {
			url: details.url,
			timestamp: details.timeStamp,
			referrer: details.documentUrl,
			userAgent: navigator.userAgent,
			resourceType: details.type as RequestContext['resourceType'],
		};

		try {
			const [m1, m2, m3, m4] = await Promise.all([
				rateCalc.calculate(domain, context),
				entropyCalc.calculate(domain),
				reputationCalc.calculate(domain),
				behaviorCalc.calculate(domain, context),
			]);

			const { riskScore, confidence } = await riskAgg.aggregate([m1, m2, m3, m4]);

			const profile = await getDomainProfile(domain);
			if (profile) {
				if (!profile.riskHistory) profile.riskHistory = [];
				profile.riskHistory.push({ timestamp: context.timestamp, riskScore });
				if (profile.riskHistory.length > 100) profile.riskHistory.shift();
				await updateDomainProfile(domain, profile);
			}

			if (riskScore >= config.thresholds.critical && confidence > 0.7) {
				console.warn(
					`[DNS Sentinel] Critical risk detected: ${domain} (score: ${riskScore.toFixed(3)})`,
				);
			}
		} catch (error) {
			console.error(`[DNS Sentinel] Error processing ${domain}:`, error);
		}
	},
	{ urls: ['<all_urls>'] },
	['requestBody'],
);
