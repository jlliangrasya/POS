// Builds one JS bundle for the hosted demo link.
// React and ReactDOM load from a CDN, so they are left out of the bundle.
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react({ jsxRuntime: 'classic' })],
  build: {
    outDir: 'dist-artifact',
    emptyOutDir: true,
    cssCodeSplit: false,
    rollupOptions: {
      input: 'src/main.jsx',
      external: ['react', 'react-dom', 'react-dom/client'],
      output: {
        format: 'iife',
        entryFileNames: 'app.js',
        assetFileNames: 'app.[ext]',
        globals: { react: 'React', 'react-dom': 'ReactDOM', 'react-dom/client': 'ReactDOM' },
      },
    },
  },
});
