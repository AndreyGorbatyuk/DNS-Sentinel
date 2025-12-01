export function getGoogleSafeBrowsingKey(): string {
	if (typeof process !== 'undefined' && process.env?.GOOGLE_SAFE_BROWSING_KEY) {
		return process.env.GOOGLE_SAFE_BROWSING_KEY;
	}
	return '';
}

export function getPhishTankKey(): string {
	if (typeof process !== 'undefined' && process.env?.PHISHTANK_APP_KEY) {
		return process.env.PHISHTANK_APP_KEY;
	}
	return '';
}

export function getVirusTotalKey(): string {
	if (typeof process !== 'undefined' && process.env?.VIRUSTOTAL_APP_KEY) {
		return process.env.VIRUSTOTAL_APP_KEY;
	}
	return '';
}


