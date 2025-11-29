export interface Configuration {
	enabled: boolean;
	sensitivity: 'low' | 'balanced' | 'high' | 'paranoid';
	privacy: {
		collectStatistics: boolean;
		allowTelemetry: boolean;
	};
	thresholds: {
		critical: number;
		high: number;
		medium: number;
	};
	weights: {
		M1: number;
		M2: number;
		M3: number;
		M4: number;
	};
	groups: {
		rate: {
			enabled: boolean;
			weight: number;
		};
		entropy: {
			enabled: boolean;
			weight: number;
		};
		reputation: {
			enabled: boolean;
			weight: number;
			cacheTTL: number;
			sources: Array<{
				name: string;
				enabled: boolean;
				weight: number;
			}>;
		};
		behavior: {
			enabled: boolean;
			weight: number;
			minHistoryRequests: number;
			minHistoryDays: number;
		};
	};
	storage: {
		enabled: boolean;
		maxProfiles: number;
	};
	apiKeys?: {
		googleSafeBrowsing?: string;   // Strongly recommended (10 000 requests/day free)
		phishTank?: string;            // OPTIONAL — only increases PhishTank rate limit (hard to obtain in 2025)
		virusTotal?: string;           // Optional extra check
	};
}

export interface RequestContext {
	url: string;
	timestamp: number;
	referrer?: string;
	userAgent: string;
	resourceType?:
		| 'main_frame'
		| 'sub_frame'
		| 'script'
		| 'xhr'
		| 'image'
		| 'stylesheet'
		| 'font'
		| 'media'
		| 'websocket'
		| 'other';
}

export interface MetricResult {
	id: string;
	value: number;
	confidence: number;
	details: Record<string, any>;
}

export interface WelfordStats {
	count: number;
	mean: number;
	M2: number;
}

export interface DomainProfile {
	domain: string;
	firstSeen: number;
	lastSeen: number;
	requestCount: number;
	timeSeries: {
		minutely: number[];
		fiveMinute: number[];
		fifteenMinute: number[];
	};
	stats: {
		rate: {
			oneMinute: WelfordStats;
			fiveMinute: WelfordStats;
			fifteenMinute: WelfordStats;
		};
		interArrival?: WelfordStats;
	};
	accessHours?: number[];
	dayFrequencies?: number[];
	typicalReferrers?: string[];
	directAccessToSensitive?: boolean;
	reputationCache?: Array<{
		source: string;
		score: number;
		timestamp: number;
		confidence?: number;
	}>;
	riskHistory?: Array<{ timestamp: number; riskScore: number }>;
	lastAlerted?: number;
	userWhitelisted?: boolean;
	userBlacklisted?: boolean;
	_version?: number;
	_updatedAt?: number;
}
