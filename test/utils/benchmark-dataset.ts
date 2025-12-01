import 'dotenv/config';
import '../mocks/chrome-for-node';
import '../../src/background/reputation/_node-fetch-fix';

import { readFile, writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import { getGoogleSafeBrowsingKey, getPhishTankKey } from '../../src/background/reputation/_env.js';
import { ReputationMetricCalculator } from '../../src/background/analysis/reputation-calculator.js';
import { saveConfig } from '../../src/background/storage/configuration-store.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface DatasetEntry {
	domain: string;
	label: 'legitimate' | 'phishing' | 'dga';
}

interface BenchmarkResult {
	domain: string;
	label: 'legitimate' | 'phishing' | 'dga';
	score: number;
	confidence: number;
	timeMs: number;
}

function getGitCommitSha(): string {
	try {
		return execSync('git rev-parse HEAD', { encoding: 'utf-8' }).trim().slice(0, 7);
	} catch {
		return 'unknown';
	}
}

async function loadDataset(csvPath: string): Promise<DatasetEntry[]> {
	const content = await readFile(csvPath, 'utf-8');
	const lines = content.split('\n').slice(1).filter(l => l.trim());
	return lines.map(line => {
		const [domain, label] = line.split(',');
		return { domain: domain!.trim(), label: label!.trim() as 'legitimate' | 'phishing' | 'dga' };
	});
}

function updateProgress(current: number, total: number, startTime: number) {
	const elapsed = Date.now() - startTime;
	const rate = current / (elapsed / 1000);
	const remaining = total - current;
	const eta = remaining / rate;
	const percent = Math.round((current / total) * 100);
	const barWidth = 40;
	const filled = Math.round((current / total) * barWidth);
	const bar = '█'.repeat(filled) + '░'.repeat(barWidth - filled);
	process.stdout.write(`\r[${bar}] ${percent}% (${current}/${total}) | ${rate.toFixed(1)}/s | ETA: ${Math.round(eta)}s`);
}

function calculateMetrics(results: BenchmarkResult[], threshold: number) {
	const tp = results.filter(r => (r.label === 'phishing' || r.label === 'dga') && r.score >= threshold).length;
	const fp = results.filter(r => r.label === 'legitimate' && r.score >= threshold).length;
	const tn = results.filter(r => r.label === 'legitimate' && r.score < threshold).length;
	const fn = results.filter(r => (r.label === 'phishing' || r.label === 'dga') && r.score < threshold).length;
	
	const tpr = tp + fn > 0 ? tp / (tp + fn) : 0;
	const fpr = fp + tn > 0 ? fp / (fp + tn) : 0;
	
	return { tpr, fpr, tp, fp, tn, fn };
}

function findWorstFalsePositives(results: BenchmarkResult[], threshold: number, limit: number = 10) {
	return results
		.filter(r => r.label === 'legitimate' && r.score >= threshold)
		.sort((a, b) => b.score - a.score)
		.slice(0, limit)
		.map(r => ({ domain: r.domain, score: r.score }));
}

function findWorstFalseNegatives(results: BenchmarkResult[], threshold: number, limit: number = 10) {
	return results
		.filter(r => (r.label === 'phishing' || r.label === 'dga') && r.score < threshold)
		.sort((a, b) => a.score - b.score)
		.slice(0, limit)
		.map(r => ({ domain: r.domain, label: r.label, score: r.score }));
}

function percentile(arr: number[], p: number): number {
	const sorted = [...arr].sort((a, b) => a - b);
	const index = Math.ceil((p / 100) * sorted.length) - 1;
	return sorted[Math.max(0, index)] || 0;
}

async function generateReport(results: BenchmarkResult[], outputPath: string) {
	const date = new Date().toISOString().split('T')[0];
	const commitSha = getGitCommitSha();
	
	const total = results.length;
	const byLabel = results.reduce((acc, r) => {
		acc[r.label] = (acc[r.label] || 0) + 1;
		return acc;
	}, {} as Record<string, number>);
	
	const times = results.map(r => r.timeMs);
	const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
	const p95Time = percentile(times, 95);
	
	const thresholds = [0.3, 0.35, 0.4, 0.45, 0.5, 0.55, 0.6, 0.65, 0.7, 0.75, 0.8];
	const metricsTable = thresholds.map(t => {
		const m = calculateMetrics(results, t);
		return `| ${t.toFixed(2)} | ${(m.tpr * 100).toFixed(2)}% | ${(m.fpr * 100).toFixed(2)}% |`;
	}).join('\n');
	
	const optimalThreshold = thresholds.reduce((best, t) => {
		const m = calculateMetrics(results, t);
		const score = m.tpr - (m.fpr * 10);
		const bestM = calculateMetrics(results, best);
		const bestScore = bestM.tpr - (bestM.fpr * 10);
		return score > bestScore ? t : best;
	}, 0.5);
	
	const optimalMetrics = calculateMetrics(results, optimalThreshold);
	const fprPercent = optimalMetrics.fpr * 100;
	const fprDisplay = fprPercent < 0.1 ? `<0.1` : fprPercent.toFixed(1);
	const summary = `${(optimalMetrics.tpr * 100).toFixed(1)}% detection at ${fprDisplay}% FPR`;
	
	const worstFP = findWorstFalsePositives(results, optimalThreshold);
	const worstFN = findWorstFalseNegatives(results, optimalThreshold);
	
	const markdown = `# DNS-Sentinel Benchmark Report

**Date:** ${date}  
**Git Commit:** \`${commitSha}\`

## Dataset Overview

- **Total Domains:** ${total.toLocaleString()}
- **Legitimate:** ${byLabel.legitimate?.toLocaleString() || 0}
- **Phishing:** ${byLabel.phishing?.toLocaleString() || 0}
- **DGA:** ${byLabel.dga?.toLocaleString() || 0}

## Performance Metrics

- **Average Processing Time:** ${avgTime.toFixed(2)} ms
- **95th Percentile Time:** ${p95Time.toFixed(2)} ms

## Detection Performance by Threshold

| Threshold | TPR (Phishing+DGA) | FPR (Legitimate) |
|-----------|-------------------|------------------|
${metricsTable}

## Optimal Threshold Analysis

**Recommended Threshold:** ${optimalThreshold.toFixed(2)}  
**Summary:** ${summary}

## Error Analysis

### Top 10 Worst False Positives (Legitimate domains flagged)

| Domain | Score |
|--------|-------|
${worstFP.map(f => `| \`${f.domain}\` | ${f.score.toFixed(4)} |`).join('\n')}

### Top 10 Worst False Negatives (Threats missed)

| Domain | Label | Score |
|--------|-------|-------|
${worstFN.map(f => `| \`${f.domain}\` | ${f.label} | ${f.score.toFixed(4)} |`).join('\n')}

---

*Generated by DNS-Sentinel benchmark tool*
`;

	await writeFile(outputPath, markdown, 'utf-8');
}

const CACHE_FILE = join(__dirname, '..', '.api-cache.json');

async function loadCache(): Promise<Record<string, any>> {
	try {
		const content = await readFile(CACHE_FILE, 'utf-8');
		return JSON.parse(content);
	} catch {
		return {};
	}
}

async function saveCache(cache: Record<string, any>): Promise<void> {
	await writeFile(CACHE_FILE, JSON.stringify(cache, null, 2), 'utf-8');
}

async function getCachedResult(domain: string, cache: Record<string, any>): Promise<BenchmarkResult | null> {
	return cache[domain] || null;
}

async function main() {
	console.log('='.repeat(60));
	console.log('DNS-Sentinel Dataset Benchmark');
	console.log('='.repeat(60));
	
	const originalConsoleError = console.error;
	const originalConsoleWarn = console.warn;
	
	console.error = (...args: any[]) => {
		const msg = args[0]?.toString() || '';
		if (msg.includes('Real TLS certificate error') || 
		    msg.includes('API error:') ||
		    msg.includes('Google Safe Browsing skipped') ||
		    msg.includes('PhishTank rate limit')) {
			return;
		}
		originalConsoleError.apply(console, args);
	};
	
	console.warn = (...args: any[]) => {
		const msg = args[0]?.toString() || '';
		if (msg.includes('Google Safe Browsing skipped') ||
		    msg.includes('PhishTank rate limit')) {
			return;
		}
		originalConsoleWarn.apply(console, args);
	};
	
	const gsbKey = getGoogleSafeBrowsingKey();
	const ptKey = getPhishTankKey();
	
	if (gsbKey || ptKey) {
		logProgress('Configuring API keys...');
		await saveConfig({
			apiKeys: {
				googleSafeBrowsing: gsbKey,
				phishTank: ptKey,
				virusTotal: '',
			},
		});
		logProgress('✓ API keys configured\n');
	}

	// Determine which dataset to benchmark.
	// Usage examples:
	//   pnpm run dataset:bench                -> uses test_40k.csv (default)
	//   pnpm run dataset:bench -- test_3k.csv -> uses test_3k.csv
	const args = process.argv.slice(2).filter(a => a !== '--');
	const datasetFile = args[0] && !args[0].startsWith('-') ? args[0] : 'test_40k.csv';

	const datasetPath = join(__dirname, '..', 'dataset', datasetFile);

	// Derive suffix for results/report filenames based on dataset name
	const baseName = datasetFile.replace(/\.csv$/i, '');
	const suffix = baseName ? `_${baseName}` : '';

	const resultsPath = join(__dirname, '..', 'dataset', `results${suffix}.json`);
	const reportPath = join(__dirname, '..', 'dataset', `BENCHMARK_REPORT${suffix}.md`);
	
	logProgress(`Using dataset file: ${datasetFile}`);
	
	logProgress('Loading dataset...');
	const dataset = await loadDataset(datasetPath);
	logProgress(`✓ Loaded ${dataset.length} domains\n`);
	
	logProgress('Loading API cache...');
	const cache = await loadCache();
	const cachedCount = Object.keys(cache).length;
	logProgress(`✓ Cache loaded: ${cachedCount} cached results\n`);
	
	const calculator = new ReputationMetricCalculator();
	const results: BenchmarkResult[] = [];
	const startTime = Date.now();
	
	logProgress('Running benchmark...\n');
	
	for (let i = 0; i < dataset.length; i++) {
		const entry = dataset[i]!;
		const cached = await getCachedResult(entry.domain, cache);
		
		if (cached) {
			results.push(cached);
		} else {
			const domainStart = Date.now();
			
			try {
				const metricResult = await calculator.calculate(entry.domain);
				const timeMs = Date.now() - domainStart;
				
				const result: BenchmarkResult = {
					domain: entry.domain,
					label: entry.label,
					score: metricResult.value,
					confidence: metricResult.confidence,
					timeMs,
				};
				
				results.push(result);
				cache[entry.domain] = result;
			} catch (error) {
				const timeMs = Date.now() - domainStart;
				const result: BenchmarkResult = {
					domain: entry.domain,
					label: entry.label,
					score: 0.5,
					confidence: 0.0,
					timeMs,
				};
				results.push(result);
				cache[entry.domain] = result;
			}
		}
		
		if ((i + 1) % 10 === 0 || i === dataset.length - 1) {
			updateProgress(i + 1, dataset.length, startTime);
		}
	}
	
	logProgress('\nSaving cache...');
	await saveCache(cache);
	logProgress('✓ Cache saved\n');
	
	console.log('\n');
	logProgress('Saving results...');
	await mkdir(dirname(resultsPath), { recursive: true });
	await writeFile(resultsPath, JSON.stringify(results, null, 2), 'utf-8');
	logProgress(`✓ Results saved to ${resultsPath}\n`);
	
	logProgress('Generating report...');
	await generateReport(results, reportPath);
	logProgress(`✓ Report saved to ${reportPath}\n`);
	
	const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
	const avgTime = (results.reduce((sum, r) => sum + r.timeMs, 0) / results.length).toFixed(2);
	
	console.error = originalConsoleError;
	console.warn = originalConsoleWarn;
	
	console.log('='.repeat(60));
	console.log('Benchmark Complete!');
	console.log('='.repeat(60));
	console.log(`Total time: ${totalTime}s`);
	console.log(`Average time per domain: ${avgTime}ms`);
	console.log(`Results: ${resultsPath}`);
	console.log(`Report: ${reportPath}`);
	console.log('='.repeat(60));
}

function logProgress(message: string) {
	console.log(`[${new Date().toLocaleTimeString()}] ${message}`);
}

main().catch(error => {
	console.error('\n❌ Benchmark failed:', error);
	process.exit(1);
});

