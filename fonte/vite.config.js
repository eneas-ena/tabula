import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';
export default defineConfig({
  plugins: [react(), viteSingleFile({ removeViteModuleLoader: true })],
  define: { 'process.env.NODE_ENV': '"production"', 'process.env.IS_PREACT': '"false"' },
  build: { target: 'es2020', chunkSizeWarningLimit: 20000, assetsInlineLimit: 100000000 },
});
