import type { Configuration, DomainProfile } from '../../types/index.js';
import { getConfig } from '../storage/configuration-store.js';
import { getDomainProfile, updateDomainProfile } from '../storage/domain-statistics.js';

const THROTTLE_MS = 5 * 60 * 1000;
let clickHandlerSetup = false;

function setupClickHandler(): void {
	if (clickHandlerSetup) return;
	clickHandlerSetup = true;
	chrome.notifications.onClicked.addListener(() => {
		chrome.action.openPopup().catch(() => {
			chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
		});
	});
}

export async function notifyCriticalRisk(domain: string, riskScore: number): Promise<void> {
	const config: Configuration = await getConfig();
	const threshold = config.thresholds.critical;
	if (riskScore < threshold && riskScore < 0.90) return;

	const profile = await getDomainProfile(domain);
	const now = Date.now();
	if (profile?.lastAlerted && now - profile.lastAlerted < THROTTLE_MS) return;

	setupClickHandler();

	const allowTelemetry = config.privacy.allowTelemetry;
	const priority = allowTelemetry ? 2 : 1;
	const silent = !allowTelemetry;

	await chrome.notifications.create({
		type: 'basic',
		iconUrl: '/icons/icon-128.png',
		title: 'DNS Sentinel — Critical Threat Detected',
		message: `Domain ${domain} blocked — risk score: ${riskScore.toFixed(2)}`,
		priority,
		requireInteraction: true,
		silent,
	});

	if (!silent) {
		chrome.tts.speak('Critical threat detected', { rate: 1.2, volume: 0.5 });
	}

	if (profile) {
		profile.lastAlerted = now;
		await updateDomainProfile(domain, profile);
	}
}

