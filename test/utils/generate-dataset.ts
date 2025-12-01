// test/utils/generate-dataset.ts
import { writeFile, mkdir, readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface DomainEntry {
	domain: string;
	label: 'legitimate' | 'phishing' | 'dga';
}

function extractSecondLevelDomain(input: string): string | null {
	try {
		// Remove protocol, www, and path
		let domain = input
			.replace(/^https?:\/\//i, '')
			.replace(/^www\./i, '')
			.split('/')[0]
			.split('?')[0]
			.split('#')[0]
			.trim()
			.toLowerCase();
		
		// Remove port
		domain = domain.split(':')[0];
		
		// Extract second-level domain
		const parts = domain.split('.');
		if (parts.length < 2) return null;
		
		// Handle special cases like .co.uk, .com.au
		const tlds = ['co', 'com', 'net', 'org', 'gov', 'edu', 'ac', 'sch'];
		if (parts.length >= 3 && tlds.includes(parts[parts.length - 2]!)) {
			return parts.slice(-3).join('.');
		}
		
		return parts.slice(-2).join('.');
	} catch {
		return null;
	}
}

function logProgress(message: string) {
	console.log(`[${new Date().toLocaleTimeString()}] ${message}`);
}

function shuffleArray<T>(array: T[]): T[] {
	const shuffled = [...array];
	for (let i = shuffled.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
	}
	return shuffled;
}

async function loadDomainsFromCsvFile(
	relativePath: string,
	domainColumnIndex: number | null = null
): Promise<Set<string>> {
	const fullPath = join(__dirname, '..', 'dataset', relativePath);
	logProgress(`Loading CSV domains from ${relativePath}...`);

	try {
		const text = await readFile(fullPath, 'utf-8');
		const lines = text.split('\n');
		const domains = new Set<string>();
		let parsed = 0;

		for (const line of lines) {
			const trimmed = line.trim();
			if (!trimmed || trimmed.startsWith('#')) continue;

			const parts = trimmed.split(',');

			let candidate: string | null = null;
			if (domainColumnIndex !== null && parts[domainColumnIndex]) {
				candidate = parts[domainColumnIndex];
			} else {
				// Try all columns until one yields a valid domain
				for (const p of parts) {
					const d = extractSecondLevelDomain(p);
					if (d) {
						candidate = p;
						break;
					}
				}
			}

			if (!candidate) continue;
			const domain = extractSecondLevelDomain(candidate);
			if (!domain) continue;

			domains.add(domain);
			parsed++;
		}

		logProgress(`✓ Parsed ${parsed} lines, got ${domains.size} unique domains from ${relativePath}`);
		return domains;
	} catch (error) {
		logProgress(`⚠ Failed to read ${relativePath}: ${(error as Error).message}`);
		return new Set<string>();
	}
}

async function loadDomainsFromTxtFile(relativePath: string): Promise<Set<string>> {
	const fullPath = join(__dirname, '..', 'dataset', relativePath);
	logProgress(`Loading text domains from ${relativePath}...`);

	try {
		const text = await readFile(fullPath, 'utf-8');
		const lines = text.split('\n');
		const domains = new Set<string>();
		let parsed = 0;

		for (const line of lines) {
			const trimmed = line.trim();
			if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('//')) continue;

			const domain = extractSecondLevelDomain(trimmed);
			if (!domain) continue;

			domains.add(domain);
			parsed++;
		}

		logProgress(`✓ Parsed ${parsed} lines, got ${domains.size} unique domains from ${relativePath}`);
		return domains;
	} catch (error) {
		logProgress(`⚠ Failed to read ${relativePath}: ${(error as Error).message}`);
		return new Set<string>();
	}
}

// Local dataset loaders based on your downloaded files:
// - legitimate.csv
// - phishing_feed.txt
// - dga_domains_full.csv

async function loadLegitimateDomains(): Promise<Set<string>> {
	// Assume legitimate.csv has at least one column that is the domain.
	// If it's rank,domain, we want column 1 (index 1). If unsure, set to null to auto-detect.
	return loadDomainsFromCsvFile('legitimate.csv', 1);
}

async function loadPhishingDomains(): Promise<Set<string>> {
	// phishing_feed.txt: one URL/domain per line
	return loadDomainsFromTxtFile('phishing_feed.txt');
}

async function loadDGADomains(): Promise<Set<string>> {
	// dga_domains_full.csv lines look like: type,source,domain
	// where type is "dga" or "legit". We only want rows with type === "dga".
	const fullPath = join(__dirname, '..', 'dataset', 'dga_domains_full.csv');
	logProgress('Loading DGA domains from dga_domains_full.csv...');

	try {
		const text = await readFile(fullPath, 'utf-8');
		const lines = text.split('\n');
		const domains = new Set<string>();
		let parsed = 0;
		let skippedNonDga = 0;

		for (const line of lines) {
			const trimmed = line.trim();
			if (!trimmed || trimmed.startsWith('#')) continue;

			const parts = trimmed.split(',');
			if (parts.length < 3) continue;

			const type = parts[0]!.trim().toLowerCase();
			if (type !== 'dga') {
				skippedNonDga++;
				continue;
			}

			// Domain is the third field
			const rawDomain = parts[2]!.trim();
			const domain = extractSecondLevelDomain(rawDomain);
			if (!domain) continue;

			domains.add(domain);
			parsed++;
		}

		logProgress(
			`✓ Parsed ${parsed} DGA rows (skipped ${skippedNonDga} non-dga rows), got ${domains.size} unique DGA domains`
		);
		return domains;
	} catch (error) {
		logProgress(`⚠ Failed to read dga_domains_full.csv: ${(error as Error).message}`);
		return new Set<string>();
	}
}

function balanceDataset(
	legitimate: Set<string>,
	phishing: Set<string>,
	dga: Set<string>,
	isSmall: boolean = false
): DomainEntry[] {
	const dataset: DomainEntry[] = [];

	// Target sizes: max 5,000 from each group (smaller in --small mode)
	const targetLegit = isSmall ? 1000 : 5000;
	const targetPhishing = isSmall ? 1000 : 5000;
	const targetDGA = isSmall ? 1000 : 5000;

	const legitArray = shuffleArray(Array.from(legitimate));
	const phishArray = shuffleArray(Array.from(phishing));
	const dgaArray = shuffleArray(Array.from(dga));

	logProgress(`\nBalancing dataset:`);
	logProgress(`  Available: ${legitArray.length} legitimate, ${phishArray.length} phishing, ${dgaArray.length} DGA`);
	logProgress(`  Target (max): ${targetLegit} legitimate, ${targetPhishing} phishing, ${targetDGA} DGA`);

	const used = new Set<string>();

	// To avoid label conflicts, we add phishing and DGA first, then legitimate.

	let phishAdded = 0;
	for (const domain of phishArray) {
		if (phishAdded >= targetPhishing) break;
		if (used.has(domain)) continue;
		dataset.push({ domain, label: 'phishing' });
		used.add(domain);
		phishAdded++;
	}

	let dgaAdded = 0;
	for (const domain of dgaArray) {
		if (dgaAdded >= targetDGA) break;
		if (used.has(domain)) continue;
		dataset.push({ domain, label: 'dga' });
		used.add(domain);
		dgaAdded++;
	}

	let legitAdded = 0;
	for (const domain of legitArray) {
		if (legitAdded >= targetLegit) break;
		if (used.has(domain)) continue;
		dataset.push({ domain, label: 'legitimate' });
		used.add(domain);
		legitAdded++;
	}

	logProgress(
		`✓ Balanced dataset: ${dataset.length} total domains (legit=${legitAdded}, phishing=${phishAdded}, dga=${dgaAdded})`
	);
	return dataset;
}

async function saveDataset(dataset: DomainEntry[], outputPath: string) {
	logProgress(`\nSaving dataset to ${outputPath}...`);
	
	// Shuffle the dataset
	const shuffled = shuffleArray(dataset);
	
	const csv = ['domain,label', ...shuffled.map(d => `${d.domain},${d.label}`)].join('\n');
	await mkdir(dirname(outputPath), { recursive: true });
	await writeFile(outputPath, csv, 'utf-8');
	
	logProgress(`✓ Dataset saved: ${shuffled.length} domains (shuffled)`);
}

async function main() {
	const isSmall = process.argv.includes('--small');
	
	console.log('='.repeat(60));
	console.log('DNS-Sentinel Dataset Generator');
	if (isSmall) {
		console.log('Mode: SMALL (~3000 domains)');
	}
	console.log('='.repeat(60));
	
	try {
		logProgress('Starting dataset generation from local files...\n');

		// Load all local sources in parallel
		const [legitimate, phishing, dga] = await Promise.all([
			loadLegitimateDomains(),
			loadPhishingDomains(),
			loadDGADomains()
		]);
		
		logProgress(`\nSummary:`);
		logProgress(`  Legitimate: ${legitimate.size}`);
		logProgress(`  Phishing: ${phishing.size}`);
		logProgress(`  DGA: ${dga.size}`);
		
		// Balance and create dataset
		const dataset = balanceDataset(legitimate, phishing, dga, isSmall);
		
		if (dataset.length === 0) {
			console.error('\n❌ Error: No domains collected. Check your internet connection and source availability.');
			process.exit(1);
		}
		
		// Save dataset
		const outputPath = join(__dirname, '..', 'dataset', isSmall ? 'test_3k.csv' : 'test_40k.csv');
		await saveDataset(dataset, outputPath);
		
		// Final statistics
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
