import type { RequestContext } from '../types/index.js';
import { RiskAggregator } from './aggregators/risk-aggregator.js';
import { BehaviorMetricCalculator } from './analysis/behavior-calculator.js';
import { EntropyMetricCalculator } from './analysis/entropy-calculator.js';
import { RateMetricCalculator } from './analysis/rate-calculator.js';
import { ReputationMetricCalculator } from './analysis/reputation-calculator.js';
import { getConfig } from './storage/configuration-store.js';
import { getDomainProfile, updateDomainProfile } from './storage/domain-statistics.js';
import { normalizeDomain } from './utils/domains.js';
import { notifyCriticalRisk } from './utils/notifier.js';

const rateCalc = new RateMetricCalculator();
const entropyCalc = new EntropyMetricCalculator();
const reputationCalc = new ReputationMetricCalculator();
const behaviorCalc = new BehaviorMetricCalculator();
const riskAgg = new RiskAggregator();

async function addBlockRule(domain: string): Promise<void> {
	const ruleId = Date.now();
	const rule: chrome.declarativeNetRequest.Rule = {
		id: ruleId,
		priority: 1,
		action: { type: chrome.declarativeNetRequest.RuleActionType.BLOCK },
		condition: {
			urlFilter: `||${domain}^`,
			resourceTypes: [
				chrome.declarativeNetRequest.ResourceType.MAIN_FRAME,
				chrome.declarativeNetRequest.ResourceType.SUB_FRAME,
				chrome.declarativeNetRequest.ResourceType.XMLHTTPREQUEST,
				chrome.declarativeNetRequest.ResourceType.SCRIPT,
				chrome.declarativeNetRequest.ResourceType.STYLESHEET,
				chrome.declarativeNetRequest.ResourceType.IMAGE,
				chrome.declarativeNetRequest.ResourceType.FONT,
				chrome.declarativeNetRequest.ResourceType.MEDIA,
				chrome.declarativeNetRequest.ResourceType.WEBSOCKET,
				chrome.declarativeNetRequest.ResourceType.OTHER,
			],
		},
	};

	const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
	if (existingRules.length >= 100) {
		const toRemove = existingRules.slice(0, existingRules.length - 99).map((r) => r.id);
		await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: toRemove });
	}

	await chrome.declarativeNetRequest.updateDynamicRules({ addRules: [rule] });
}

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
	if (changeInfo.status !== 'complete' || !tab.url) return;

	const config = await getConfig();
	if (!config.enabled) return;

	const domain = normalizeDomain(tab.url);
	if (!domain || domain === 'localhost') return;

	const context: RequestContext = {
		url: tab.url,
		timestamp: Date.now(),
		referrer: tab.openerTabId ? undefined : undefined,
		userAgent: navigator.userAgent,
		resourceType: 'main_frame',
	};

	try {
		const [m1, m2, m3, m4] = await Promise.all([
			rateCalc.calculate(domain, context),
			entropyCalc.calculate(domain),
			reputationCalc.calculate(domain),
			behaviorCalc.calculate(domain, context),
		]);

		const { riskScore, confidence } = await riskAgg.aggregate([m1, m2, m3, m4]);

		if (riskScore >= 0.9) {
			await addBlockRule(domain);
		}

		if (riskScore >= config.thresholds.critical || riskScore >= 0.9) {
			notifyCriticalRisk(domain, riskScore).catch(console.error);
		}

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
});
