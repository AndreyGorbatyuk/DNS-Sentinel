import type { RequestContext } from '../types/index.js';
import { normalizeDomain } from './utils/domains.js';
import { RateMetricCalculator } from './analysis/rate-calculator.js';
import { EntropyMetricCalculator } from './analysis/entropy-calculator.js';
import { ReputationMetricCalculator } from './analysis/reputation-calculator.js';
import { BehaviorMetricCalculator } from './analysis/behavior-calculator.js';
import { RiskAggregator } from './aggregators/risk-aggregator.js';
import { getConfig } from './storage/configuration-store.js';

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

