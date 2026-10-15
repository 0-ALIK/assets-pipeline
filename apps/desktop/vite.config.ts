import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const packageJsonUrl = new URL('./package.json', import.meta.url);
const packageJson = JSON.parse(readFileSync(fileURLToPath(packageJsonUrl), 'utf8')) as {
  version: string;
};

export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(packageJson.version),
  },
  clearScreen: false,
  server: {
    strictPort: true,
  },
});
