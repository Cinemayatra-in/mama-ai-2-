import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // Set the third parameter to '' to load all env regardless of the `VITE_` prefix.
  const env = loadEnv(mode, (process as any).cwd(), '');
  return {
    plugins: [react()],
    define: {
      // JSON.stringify is needed because the 'define' replacement does a direct text replacement.
      'process.env.API_KEY': JSON.stringify(env.API_KEY)
    },
    build: {
      target: 'esnext', // Optimization: Ensure output supports modern features needed by GenAI SDK
      outDir: 'dist',
    }
  };
});