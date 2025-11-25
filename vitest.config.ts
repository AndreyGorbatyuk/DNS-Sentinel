import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		watch: false, // Disables interactive watch mode to prevent Cursor freezing
		globals: true,
		environment: 'node',
		include: ['test/**/*.{test,spec}.{js,ts}'],
		exclude: ['node_modules', 'dist', 'docs/**'],
		setupFiles: ['test/setup.ts'],
	},
});
