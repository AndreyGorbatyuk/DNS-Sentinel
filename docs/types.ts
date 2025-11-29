/**
 * @file types.ts
 * ЕДИНСТВЕННЫЙ источник правды для всех типов проекта
 * Импортируется ВЕЗДЕ вместо *.api.md
 * 
 * Версия: 2.0 (исправленная)
 */

// ============================================================================
// Configuration - Глобальные настройки системы
// ============================================================================

export interface Configuration {
	enabled: boolean;
	sensitivity: 'low' | 'balanced' | 'high' | 'paranoid';

	privacy: {
		collectStatistics: boolean;
		allowTelemetry: boolean;
	};

	thresholds: {
		critical: number;   // 0.80
		high: number;       // 0.60
		medium: number;     // 0.40
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
			cacheTTL: number;  // hours
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

// ============================================================================
// Request Context - Контекст запроса
// ============================================================================

export interface RequestContext {
	url: string;
	timestamp: number;              // Unix ms
	referrer?: string;              // Previous page
	userAgent: string;              // User Agent string
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

// ============================================================================
// Metric Result - Результат расчёта метрики
// ============================================================================

export interface MetricResult {
	id: string;                     // 'M1', 'M2', 'M3', 'M4'
	value: number;                  // [0, 1]
	confidence: number;             // [0, 1]
	details?: any;                  // Metric-specific details
}

// ============================================================================
// Welford Statistics - Инкрементальная статистика
// ============================================================================

export interface WelfordStats {
	count: number;                  // Количество наблюдений
	mean: number;                   // Среднее значение
	M2: number;                     // Сумма квадратов отклонений (для variance)
}

// ============================================================================
// Domain Profile - Профиль домена
// ============================================================================

export interface DomainProfile {
	domain: string;
	firstSeen: number;              // Unix ms
	lastSeen: number;               // Unix ms
	requestCount: number;

	// ========== Rate-specific data ==========
	timeSeries: {
		minutely: number[];           // Timestamps for 1-minute window
		fiveMinute: number[];         // Timestamps for 5-minute window
		fifteenMinute: number[];      // Timestamps for 15-minute window
	};

	stats: {
		rate: {
			oneMinute: WelfordStats;
			fiveMinute: WelfordStats;
			fifteenMinute: WelfordStats;
		};
		interArrival?: WelfordStats;   // Inter-arrival time statistics
	};

	// ========== Behavior-specific data ==========
	accessHours?: number[];          // [0-23] frequency distribution
	dayFrequencies?: number[];       // [0-6] frequency distribution (Mon=0, Sun=6)
	typicalReferrers?: string[];     // List of typical referrer URLs
	directAccessToSensitive?: boolean;

	// ========== Reputation-specific data ==========
	reputationCache?: Array<{
		source: string;               // 'PhishTank', 'Google Safe Browsing', etc.
		score: number;                // [0, 1] where 1 = malicious
		timestamp: number;            // Unix ms
	}>;

	// ========== Risk history ==========
	riskHistory?: number[];          // Historical risk scores for trend analysis

	// ========== User preferences ==========
	userWhitelisted?: boolean;
	userBlacklisted?: boolean;

	// ========== Metadata ==========
	_version?: number;              // Schema version for migrations
	_updatedAt?: number;            // Last update timestamp (Unix ms)
}