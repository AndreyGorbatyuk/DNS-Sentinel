/**
 * @file chrome-stubs.ts
 * Chrome API stubs for documentation mode
 * 
 * ВАЖНО: Используется ТОЛЬКО на этапе документации.
 * При создании реального расширения - удалите этот файл.
 */

/// <reference no-default-lib="true"/>
/// <reference lib="es2022" />

// Расширяем глобальное объявление chrome
declare global {
	interface ChromeStorageArea {
		get(key: string | string[] | Record<string, any> | null): Promise<Record<string, any>>;
		set(items: Record<string, any>): Promise<void>;
		remove(keys: string | string[]): Promise<void>;
		clear(): Promise<void>;
	}

	interface ChromeRuntime {
		sendMessage(message: any, responseCallback?: (response: any) => void): void;
		reload?(): void;
		getURL?(path: string): string;
		lastError?: { message?: string };
	}

	interface ChromeAlarms {
		create(name?: string, alarmInfo?: any): void;
		clear(name?: string): Promise<boolean>;
	}

	interface ChromeWebRequest {
		onBeforeRequest: {
			addListener(
				callback: (details: any) => void | { cancel?: boolean },
				filter: { urls: string[] },
				extraInfoSpec?: string[]
			): void;
		};
	}

	const chrome: {
		storage: {
			sync: ChromeStorageArea;
			local: ChromeStorageArea;
		};
		runtime: ChromeRuntime;
		alarms?: ChromeAlarms;
		webRequest?: ChromeWebRequest;
	};

	// Для тестового окружения
	var global: typeof globalThis;
}

// Пустой export чтобы файл считался модулем
export { };