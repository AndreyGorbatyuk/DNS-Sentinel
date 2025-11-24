import type { DomainProfile } from './types/index.js';

interface DomainRisk {
	domain: string;
	riskScore: number;
}

async function getTopRiskyDomains(): Promise<DomainRisk[]> {
	const all = await chrome.storage.local.get(null);
	const profiles: DomainRisk[] = [];

	for (const [key, value] of Object.entries(all)) {
		if (key.startsWith('profile_')) {
			const profile = value as DomainProfile;
			if (profile.riskHistory && profile.riskHistory.length > 0) {
				const latestRisk = profile.riskHistory[profile.riskHistory.length - 1];
				profiles.push({
					domain: profile.domain,
					riskScore: latestRisk,
				});
			}
		}
	}

	return profiles.sort((a, b) => b.riskScore - a.riskScore).slice(0, 5);
}

function renderDomains(domains: DomainRisk[]): void {
	const list = document.getElementById('domain-list');
	if (!list) return;

	if (domains.length === 0) {
		list.innerHTML = '<li class="empty">No domain data yet</li>';
		return;
	}

	list.innerHTML = domains
		.map((domain) => {
			const riskClass =
				domain.riskScore >= 0.8
					? 'risk-high'
					: domain.riskScore >= 0.5
						? 'risk-medium'
						: 'risk-low';
			return `
			<li class="domain-item">
				<span class="domain-name">${domain.domain}</span>
				<span class="risk-score ${riskClass}">${(domain.riskScore * 100).toFixed(0)}%</span>
			</li>
		`;
		})
		.join('');
}

async function init(): Promise<void> {
	const domains = await getTopRiskyDomains();
	renderDomains(domains);
}

init();
