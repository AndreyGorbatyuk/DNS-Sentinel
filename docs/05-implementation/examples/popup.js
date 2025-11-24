// popup.js - минимальная логика для демонстрации пайплайна

import { getConfig } from './configuration-store.js';
import { RateMetricCalculator } from './rate-calculator.js';
import { RiskAggregator } from './risk-aggregator.js';

let config;
const aggregator = new RiskAggregator();
const rateCalc = new RateMetricCalculator();

// Хардкоженные тестовые домены
const TEST_DOMAINS = [
	'google.com',
	'facebook.com',
	'github.com',
	'x7k9p2m4q8r5.net',
	'a1b2c3d4e5f6.com',
	'legitimate-bank.com',
	'paypa1-secure.net',
	'amaz0n-login.com',
	'microsofft-support.com',
	'apple-verify.net',
];

async function init() {
	config = await getConfig();
	updateStatus();
	document.getElementById('scan').addEventListener('click', scanCurrentTab);
}

function updateStatus() {
	const statusEl = document.getElementById('status');
	if (config.enabled) {
		statusEl.className = 'enabled';
		statusEl.textContent = `Status: Active (${config.sensitivity})`;
	} else {
		statusEl.className = 'disabled';
		statusEl.textContent = 'Status: Disabled';
	}
}

async function scanCurrentTab() {
	const resultsEl = document.getElementById('results');
	resultsEl.innerHTML = '<div style="padding:8px;color:#666">Scanning...</div>';

	const results = [];

	// Прогон первых 5 доменов через пайплайн
	for (let i = 0; i < 5; i++) {
		const domain = TEST_DOMAINS[i];
		const context = {
			url: `https://${domain}/`,
			timestamp: Date.now(),
			userAgent: navigator.userAgent,
			resourceType: 'main_frame',
		};

		// Только M1 (rate) для демонстрации
		const m1 = await rateCalc.calculate(domain, context);

		// Агрегация
		const { riskScore, confidence } = await aggregator.aggregate([m1]);

		results.push({
			domain,
			risk: riskScore,
			confidence,
			level: getRiskLevel(riskScore),
		});
	}

	renderRisks(results);
}

function getRiskLevel(score) {
	if (score >= config.thresholds.critical) return 'critical';
	if (score >= config.thresholds.high) return 'high';
	if (score >= config.thresholds.medium) return 'medium';
	return 'safe';
}

function renderRisks(results) {
	const resultsEl = document.getElementById('results');
	resultsEl.innerHTML = results
		.map(
			(r) => `
		<div class="domain">
			<span class="domain-name">${r.domain}</span>
			<span class="risk ${r.level}">${(r.risk * 100).toFixed(0)}%</span>
		</div>
	`,
		)
		.join('');
}

// Запуск
init().catch((err) => console.error('Init failed:', err));
