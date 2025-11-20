import type { RequestContext } from '../types/index.ts';
import { normalizeDomain } from './utils/domains.ts';
import { RateMetricCalculator } from './analysis/rate-calculator.ts';
import { EntropyMetricCalculator } from './analysis/entropy-calculator.ts';
import { ReputationMetricCalculator } from './analysis/reputation-calculator.ts';
import { BehaviorMetricCalculator } from './analysis/behavior-calculator.ts';
import { RiskAggregator } from './aggregators/risk-aggregator.ts';
import { getConfig } from './storage/configuration-store.ts';

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

			if (riskScore >= config.thresholds.critical && confidence > 0.7) {
				console.warn(`[DNS Sentinel] Critical risk detected: ${domain} (score: ${riskScore.toFixed(3)})`);
			}
		} catch (error) {
			console.error(`[DNS Sentinel] Error processing ${domain}:`, error);
		}
	},
	{ urls: ['<all_urls>'] },
	['requestBody']
);

