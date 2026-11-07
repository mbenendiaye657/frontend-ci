import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// En développement, /api est redirigé vers le backend Flask (port 5000) tel quel :
// les routes de l'API sont préfixées /api (document de modélisation), comme dans nginx.conf en production.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: 'node',
  },
});
