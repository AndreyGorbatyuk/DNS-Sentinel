import { defineConfig } from 'vite';
import webExtension from 'vite-plugin-web-extension';
import { resolve } from 'path';
import { copyFileSync, mkdirSync, existsSync, readdirSync, statSync } from 'fs';

// Plugin to copy icons directory - runs after bundle is written
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

export default defineConfig({
  root: 'src',
  plugins: [
    copyIcons(),
    webExtension({
      manifest: './manifest.json',
      watchFilePaths: ['icons/**/*'],
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

