// background-demo.js - демонстрация пайплайна анализа доменов

import { getConfig } from './configuration-store.js';
import { RateMetricCalculator } from './rate-calculator.js';
import { RiskAggregator } from './risk-aggregator.js';

// Хардкоженные тестовые домены
const TEST_DOMAINS = [
	'google.com',
	'facebook.com',
	'github.com',
	'stackoverflow.com',
	'wikipedia.org',
	'x7k9p2m4q8r5.net',
	'a1b2c3d4e5f6.com',
	'paypa1-secure.net',
	'amaz0n-login.com',
	'microsofft-support.com',
	'apple-verify.net',
	'g00gle-drive.net',
	'faceb00k-security.com',
	'github-enterprise.net',
	'reddit-login.com',
];

let logEl;
let config;

function log(msg) {
	logEl.textContent += `${msg}\n`;
	console.log(msg);
}

async function runPipelineTest() {
	logEl = document.getElementById('log');
	logEl.textContent = '';

	log('=== DNS Sentinel Pipeline Demo ===\n');

	// Загрузка конфигурации
	config = await getConfig();
	log(`Config loaded: sensitivity=${config.sensitivity}`);
	log(
		`Thresholds: critical=${config.thresholds.critical}, high=${config.thresholds.high}, medium=${config.thresholds.medium}`,
	);
	log(
		`Rate calculator: enabled=${config.groups.rate.enabled}, weight=${config.groups.rate.weight}\n`,
	);

	const aggregator = new RiskAggregator();
	const rateCalc = new RateMetricCalculator();

	log('Starting domain analysis...\n');

	// Прогон 15 доменов
	for (let i = 0; i < TEST_DOMAINS.length; i++) {
		const domain = TEST_DOMAINS[i];

		// Контекст запроса
		const context = {
			url: `https://${domain}/`,
			timestamp: Date.now() + i * 100,
			userAgent: 'Mozilla/5.0 (Demo)',
			resourceType: 'main_frame',
		};

		// M1: Rate calculation
		const m1 = await rateCalc.calculate(domain, context);

		// Агрегация риска
		const { riskScore, confidence } = await aggregator.aggregate([m1]);

		// Определение уровня
		const level = getRiskLevel(riskScore);
		const riskPct = (riskScore * 100).toFixed(1);
		const confPct = (confidence * 100).toFixed(0);

		// Форматированный вывод
		const padding = ' '.repeat(Math.max(0, 30 - domain.length));
		log(`${domain}${padding} → risk: ${riskPct}% (${level}) [conf: ${confPct}%]`);

		// Небольшая задержка для имитации реальной обработки
		await sleep(50);
	}

	log('\n=== Pipeline test completed ===');
	log(`Total domains processed: ${TEST_DOMAINS.length}`);
	log(`Rate metric weight: ${config.groups.rate.weight}`);
	log('Other metrics (M2-M4): disabled for demo');
}

function getRiskLevel(score) {
	if (score >= config.thresholds.critical) return 'CRITICAL';
	if (score >= config.thresholds.high) return 'HIGH';
	if (score >= config.thresholds.medium) return 'MEDIUM';
	return 'SAFE';
}

function sleep(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

// Инициализация
document.getElementById('run').addEventListener('click', () => {
	runPipelineTest().catch((err) => {
		log(`\nERROR: ${err.message}`);
		console.error(err);
	});
});
