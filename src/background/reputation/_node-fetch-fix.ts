const isNode = typeof process !== 'undefined' && process.versions?.node;

if (isNode) {
	const originalFetch = globalThis.fetch;
	
	globalThis.fetch = async function (input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
		const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
		const headers = new Headers(init?.headers);

		if (!headers.has('User-Agent')) {
			headers.set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
		}

		if (url.includes('safebrowsing.googleapis.com')) {
			const { getGoogleSafeBrowsingKey } = await import('./_env.js');
			const key = getGoogleSafeBrowsingKey();
			if (key && !url.includes('key=')) {
				const separator = url.includes('?') ? '&' : '?';
				const modifiedUrl = `${url}${separator}key=${encodeURIComponent(key)}`;
				return originalFetch(modifiedUrl, { ...init, headers });
			}
		}

		if (url.includes('checkurl.phishtank.com')) {
			const { getPhishTankKey } = await import('./_env.js');
			const key = getPhishTankKey();
			if (key && init?.body) {
				const body = init.body instanceof URLSearchParams 
					? init.body 
					: new URLSearchParams(init.body.toString());
				if (!body.has('app_key') && key) {
					body.append('app_key', key);
				}
				return originalFetch(input, { ...init, headers, body: body.toString() });
			}
		}

		return originalFetch(input, { ...init, headers });
	};
}

