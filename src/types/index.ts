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
	details?: any;
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
	}>;
	riskHistory?: number[];
	userWhitelisted?: boolean;
	userBlacklisted?: boolean;
	_version?: number;
	_updatedAt?: number;
}

