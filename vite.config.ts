import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import webExtension from 'vite-plugin-web-extension';

function copyIcons() {
	const copyIconsFiles = () => {
		const iconsSrc = resolve(__dirname, 'src/icons');
		const iconsDest = resolve(__dirname, 'dist/icons');

		if (!existsSync(iconsSrc)) return;

		if (!existsSync(iconsDest)) {
			mkdirSync(iconsDest, { recursive: true });
		}

		const files = readdirSync(iconsSrc);
		for (const file of files) {
			const srcPath = resolve(iconsSrc, file);
			const destPath = resolve(iconsDest, file);
			if (statSync(srcPath).isFile()) {
				copyFileSync(srcPath, destPath);
			}
		}
	};

	return {
		name: 'copy-icons',
		buildStart() {
			copyIconsFiles();
		},
		writeBundle() {
			copyIconsFiles();
		},
		generateBundle() {
			copyIconsFiles();
		},
	};
}

function copyRules() {
	const copyRulesFile = () => {
		const rulesSrc = resolve(__dirname, 'src/background/rules.json');
		const rulesDest = resolve(__dirname, 'dist/background/rules.json');

		if (!existsSync(rulesSrc)) return;

		const destDir = resolve(__dirname, 'dist/background');
		if (!existsSync(destDir)) {
			mkdirSync(destDir, { recursive: true });
		}

		copyFileSync(rulesSrc, rulesDest);
	};

	return {
		name: 'copy-rules',
		buildStart() {
			copyRulesFile();
		},
		writeBundle() {
			copyRulesFile();
		},
		generateBundle() {
			copyRulesFile();
		},
	};
}

export default defineConfig({
	root: 'src',
	plugins: [
		copyIcons(),
		copyRules(),
		webExtension({
			manifest: './manifest.json',
			watchFilePaths: ['icons/**/*', 'background/rules.json'],
		}),
	],
	resolve: {
		extensions: ['.ts', '.js', '.tsx', '.jsx'],
	},
	build: {
		outDir: '../dist',
		emptyOutDir: true,
	},
});
