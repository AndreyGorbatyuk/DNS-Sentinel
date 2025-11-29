import { getConfig, saveConfig } from './background/storage/configuration-store.js';

interface APIKeys {
	googleSafeBrowsing?: string;
	phishTank?: string;
	virusTotal?: string;
}

/**
 * Tracks if fields have been modified by the user
 */
const fieldModified = new Set<string>();

/**
 * Masks an API key to show only last 4 characters
 */
function maskKey(key: string | undefined): string {
	if (!key || key.length === 0) return '';
	if (key.length <= 4) return '•'.repeat(key.length);
	return '•'.repeat(Math.max(8, key.length - 4)) + key.slice(-4);
}

/**
 * Shows a toast notification
 */
function showToast(message: string, type: 'success' | 'error'): void {
	const toast = document.getElementById('toast');
	if (!toast) return;

	toast.textContent = message;
	toast.className = `toast ${type}`;
	toast.classList.add('show');

	setTimeout(() => {
		toast.classList.remove('show');
	}, 3000);
}

/**
 * Loads current configuration and populates the form
 */
async function loadConfig(): Promise<void> {
	try {
		const config = await getConfig();
		const keys = config.apiKeys || {};

		const googleInput = document.getElementById('googleSafeBrowsing') as HTMLInputElement;
		const phishTankInput = document.getElementById('phishTank') as HTMLInputElement;
		const virusTotalInput = document.getElementById('virusTotal') as HTMLInputElement;

		if (googleInput) {
			const value = keys.googleSafeBrowsing || '';
			const masked = maskKey(value);
			googleInput.placeholder = masked || 'Enter API key';
			googleInput.value = '';
			googleInput.dataset.originalValue = value;
			googleInput.dataset.hasValue = value ? 'true' : 'false';
		}

		if (phishTankInput) {
			const value = keys.phishTank || '';
			const masked = maskKey(value);
			phishTankInput.placeholder = masked || 'Enter API key (optional)';
			phishTankInput.value = '';
			phishTankInput.dataset.originalValue = value;
			phishTankInput.dataset.hasValue = value ? 'true' : 'false';
		}

		if (virusTotalInput) {
			const value = keys.virusTotal || '';
			const masked = maskKey(value);
			virusTotalInput.placeholder = masked || 'Enter API key (optional)';
			virusTotalInput.value = '';
			virusTotalInput.dataset.originalValue = value;
			virusTotalInput.dataset.hasValue = value ? 'true' : 'false';
		}
	} catch (error) {
		console.error('Failed to load configuration:', error);
		showToast('Failed to load configuration', 'error');
	}
}

/**
 * Saves the configuration
 */
async function saveConfiguration(): Promise<void> {
	const saveBtn = document.getElementById('saveBtn') as HTMLButtonElement;
	if (saveBtn) {
		saveBtn.disabled = true;
		saveBtn.textContent = 'Saving...';
	}

	try {
		const googleInput = document.getElementById('googleSafeBrowsing') as HTMLInputElement;
		const phishTankInput = document.getElementById('phishTank') as HTMLInputElement;
		const virusTotalInput = document.getElementById('virusTotal') as HTMLInputElement;

		const apiKeys: APIKeys = {};

		// Get values: if field was modified, use the input value (even if empty to clear)
		// If field wasn't modified, keep the original value
		if (googleInput) {
			const value = googleInput.value.trim();
			const originalValue = googleInput.dataset.originalValue || '';
			
			if (fieldModified.has('googleSafeBrowsing')) {
				// User modified the field, use their value (even if empty to clear it)
				apiKeys.googleSafeBrowsing = value || '';
			} else if (originalValue) {
				// User didn't touch it, keep original
				apiKeys.googleSafeBrowsing = originalValue;
			}
		}

		if (phishTankInput) {
			const value = phishTankInput.value.trim();
			const originalValue = phishTankInput.dataset.originalValue || '';
			
			if (fieldModified.has('phishTank')) {
				apiKeys.phishTank = value || '';
			} else if (originalValue) {
				apiKeys.phishTank = originalValue;
			}
		}

		if (virusTotalInput) {
			const value = virusTotalInput.value.trim();
			const originalValue = virusTotalInput.dataset.originalValue || '';
			
			if (fieldModified.has('virusTotal')) {
				apiKeys.virusTotal = value || '';
			} else if (originalValue) {
				apiKeys.virusTotal = originalValue;
			}
		}

		await saveConfig({ apiKeys });

		// Clear modification tracking and reload to show masked values again
		fieldModified.clear();
		googleInput?.value && (googleInput.value = '');
		phishTankInput?.value && (phishTankInput.value = '');
		virusTotalInput?.value && (virusTotalInput.value = '');
		
		await loadConfig();

		showToast('Settings saved successfully', 'success');
	} catch (error) {
		console.error('Failed to save configuration:', error);
		showToast(error instanceof Error ? error.message : 'Failed to save configuration', 'error');
	} finally {
		if (saveBtn) {
			saveBtn.disabled = false;
			saveBtn.textContent = 'Save';
		}
	}
}

/**
 * Handles cancel button click
 */
function handleCancel(): void {
	// Clear modification tracking and reload to show masked values
	fieldModified.clear();
	const googleInput = document.getElementById('googleSafeBrowsing') as HTMLInputElement;
	const phishTankInput = document.getElementById('phishTank') as HTMLInputElement;
	const virusTotalInput = document.getElementById('virusTotal') as HTMLInputElement;

	if (googleInput) googleInput.value = '';
	if (phishTankInput) phishTankInput.value = '';
	if (virusTotalInput) virusTotalInput.value = '';

	loadConfig();
}

/**
 * Initialize the options page
 */
async function init(): Promise<void> {
	const saveBtn = document.getElementById('saveBtn');
	const cancelBtn = document.getElementById('cancelBtn');

	if (saveBtn) {
		saveBtn.addEventListener('click', saveConfiguration);
	}

	if (cancelBtn) {
		cancelBtn.addEventListener('click', handleCancel);
	}

	// Track field modifications
	const inputs = ['googleSafeBrowsing', 'phishTank', 'virusTotal'];
	for (const id of inputs) {
		const input = document.getElementById(id) as HTMLInputElement;
		if (input) {
			let originalPlaceholder = '';
			
			input.addEventListener('focus', () => {
				// Store original placeholder and clear it when focused so user can type
				originalPlaceholder = input.placeholder;
				if (input.dataset.originalValue && !input.value) {
					input.placeholder = '';
				}
			});
			
			input.addEventListener('blur', () => {
				// Restore placeholder if field is empty and wasn't modified
				if (!input.value && !fieldModified.has(id) && originalPlaceholder) {
					input.placeholder = originalPlaceholder;
				}
			});
			
			input.addEventListener('input', () => {
				fieldModified.add(id);
			});
		}
	}

	// Allow Enter key to save
	document.addEventListener('keydown', (e) => {
		if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
			e.preventDefault();
			saveConfiguration();
		}
	});

	await loadConfig();
}

init();

