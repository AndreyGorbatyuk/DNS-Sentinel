import { writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface DomainEntry {
	domain: string;
	label: 'legitimate' | 'phishing' | 'dga';
}

function extractSecondLevelDomain(url: string): string | null {
	try {
		const domain = url.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0].toLowerCase();
		const parts = domain.split('.');
		if (parts.length < 2) return null;
		if (parts.length === 2) return domain;
		return parts.slice(-2).join('.');
	} catch {
		return null;
	}
}

function logProgress(message: string) {
	console.log(`[${new Date().toLocaleTimeString()}] ${message}`);
}

async function fetchTrancoDomains(): Promise<Set<string>> {
	logProgress('Downloading Tranco Top 10,000...');
	try {
		const response = await fetch('https://tranco-list.eu/api_download?list=1&start=1&end=10000');
		if (!response.ok) {
			logProgress('⚠ Tranco API failed, trying alternative...');
			const altResponse = await fetch('https://tranco-list.eu/download_daily/1');
			if (!altResponse.ok) {
				logProgress('⚠ Tranco alternative failed, skipping...');
				return new Set<string>();
			}
			const text = await altResponse.text();
			const domains = new Set<string>();
			const lines = text.split('\n').slice(1);
			for (const line of lines) {
				const match = line.match(/^\d+,\d+,\d+,([^,]+)/);
				if (match) {
					const domain = extractSecondLevelDomain(match[1]);
					if (domain) domains.add(domain);
				}
			}
			logProgress(`✓ Extracted ${domains.size} legitimate domains from Tranco (alternative)`);
			return domains;
		}
		const text = await response.text();
		const domains = new Set<string>();
		const lines = text.split('\n').slice(1);
		for (const line of lines) {
			const parts = line.split(',');
			if (parts.length >= 2) {
				const domain = extractSecondLevelDomain(parts[1] || parts[0]);
				if (domain) domains.add(domain);
			}
		}
		logProgress(`✓ Extracted ${domains.size} legitimate domains from Tranco`);
		return domains;
	} catch (error) {
		logProgress('⚠ Tranco fetch failed, skipping...');
		return new Set<string>();
	}
}

async function fetchPhishTankDomains(): Promise<Set<string>> {
	logProgress('Downloading PhishTank data...');
	try {
		const response = await fetch('https://data.phishtank.com/data/online-valid.json');
		if (!response.ok) {
			logProgress('⚠ PhishTank API unavailable, skipping...');
			return new Set<string>();
		}
		const data = await response.json() as Array<{ url: string }>;
		const domains = new Set<string>();
		for (const entry of data) {
			const domain = extractSecondLevelDomain(entry.url);
			if (domain) domains.add(domain);
		}
		logProgress(`✓ Extracted ${domains.size} phishing domains from PhishTank`);
		return domains;
	} catch (error) {
		logProgress('⚠ PhishTank fetch failed, skipping...');
		return new Set<string>();
	}
}

async function fetchOpenPhishDomains(): Promise<Set<string>> {
	logProgress('Downloading OpenPhish feed...');
	try {
		const response = await fetch('https://openphish.com/feed.txt');
		if (!response.ok) {
			logProgress('⚠ OpenPhish fetch failed, skipping...');
			return new Set<string>();
		}
		const text = await response.text();
		const domains = new Set<string>();
		const lines = text.split('\n');
		for (const line of lines) {
			const trimmed = line.trim();
			if (trimmed) {
				const domain = extractSecondLevelDomain(trimmed);
				if (domain) domains.add(domain);
			}
		}
		logProgress(`✓ Extracted ${domains.size} phishing domains from OpenPhish`);
		return domains;
	} catch (error) {
		logProgress('⚠ OpenPhish fetch failed, skipping...');
		return new Set<string>();
	}
}

async function fetchDGADomains(): Promise<Set<string>> {
	logProgress('Downloading DGArchive data...');
	const sources = [
		'https://dgarchive.caad.fkie.fraunhofer.de/domains/domains.txt',
		'https://raw.githubusercontent.com/baderj/domain_generation_algorithms/master/wordlists/dga.txt',
		'https://raw.githubusercontent.com/andrewaeva/DGA/master/dga_domains.txt'
	];
	
	for (const url of sources) {
		try {
			const response = await fetch(url);
			if (response.ok) {
				const text = await response.text();
				const domains = new Set<string>();
				const lines = text.split('\n');
				for (const line of lines) {
					const trimmed = line.trim().toLowerCase();
					if (trimmed && !trimmed.startsWith('#') && !trimmed.startsWith('//')) {
						const domain = extractSecondLevelDomain(trimmed);
						if (domain && domain.length > 3) domains.add(domain);
					}
				}
				if (domains.size > 0) {
					logProgress(`✓ Extracted ${domains.size} DGA domains from ${url.includes('github') ? 'GitHub' : 'DGArchive'}`);
					return domains;
				}
			}
		} catch (error) {
			continue;
		}
	}
	
	logProgress('⚠ All DGA sources failed, skipping...');
	return new Set<string>();
}

function balanceDataset(
	legitimate: Set<string>,
	phishing: Set<string>,
	dga: Set<string>,
	targetSize: number = 40000
): DomainEntry[] {
	const perClass = Math.floor(targetSize / 3);
	const dataset: DomainEntry[] = [];
	
	const legitArray = Array.from(legitimate);
	const phishArray = Array.from(phishing);
	const dgaArray = Array.from(dga);
	
	logProgress(`Balancing dataset: ${perClass} per class...`);
	
	for (let i = 0; i < perClass && i < legitArray.length; i++) {
		dataset.push({ domain: legitArray[i]!, label: 'legitimate' });
	}
	
	for (let i = 0; i < perClass && i < phishArray.length; i++) {
		dataset.push({ domain: phishArray[i]!, label: 'phishing' });
	}
	
	for (let i = 0; i < perClass && i < dgaArray.length; i++) {
		dataset.push({ domain: dgaArray[i]!, label: 'dga' });
	}
	
	logProgress(`✓ Balanced dataset: ${dataset.length} total domains`);
	return dataset;
}

async function saveDataset(dataset: DomainEntry[], outputPath: string) {
	logProgress(`Saving dataset to ${outputPath}...`);
	const csv = ['domain,label', ...dataset.map(d => `${d.domain},${d.label}`)].join('\n');
	await mkdir(dirname(outputPath), { recursive: true });
	await writeFile(outputPath, csv, 'utf-8');
	logProgress(`✓ Dataset saved: ${dataset.length} domains`);
}

async function main() {
	console.log('='.repeat(60));
	console.log('DNS-Sentinel Dataset Generator');
	console.log('='.repeat(60));
	
	try {
		const [legitimate, phishTank, openPhish, dga] = await Promise.allSettled([
			fetchTrancoDomains(),
			fetchPhishTankDomains(),
			fetchOpenPhishDomains(),
			fetchDGADomains(),
		]).then(results => results.map(r => r.status === 'fulfilled' ? r.value : new Set<string>()));
		
		const phishing = new Set<string>();
		phishTank.forEach(d => phishing.add(d));
		openPhish.forEach(d => phishing.add(d));
		
		logProgress(`\nSummary:`);
		logProgress(`  Legitimate: ${legitimate.size}`);
		logProgress(`  Phishing: ${phishing.size}`);
		logProgress(`  DGA: ${dga.size}`);
		
		const dataset = balanceDataset(legitimate, phishing, dga, 40000);
		
		const outputPath = join(__dirname, '..', 'dataset', 'test_40k.csv');
		await saveDataset(dataset, outputPath);
		
		const labelCounts = dataset.reduce((acc, entry) => {
			acc[entry.label] = (acc[entry.label] || 0) + 1;
			return acc;
		}, {} as Record<string, number>);
		
		console.log('\n' + '='.repeat(60));
		console.log('Dataset Generation Complete!');
		console.log('='.repeat(60));
		console.log(`Total domains: ${dataset.length}`);
		console.log(`  Legitimate: ${labelCounts.legitimate || 0}`);
		console.log(`  Phishing: ${labelCounts.phishing || 0}`);
		console.log(`  DGA: ${labelCounts.dga || 0}`);
		console.log(`Output: ${outputPath}`);
		console.log('='.repeat(60));
	} catch (error) {
		console.error('\n❌ Error generating dataset:', error);
		process.exit(1);
	}
}

main();

