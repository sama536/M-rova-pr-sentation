import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig(({ mode }) => {
  // Le proxy suit le PORT de l'API défini dans beatmind/.env
  const env = loadEnv(mode, path.resolve(__dirname, '..'), '');
  const api = `http://localhost:${env.PORT || 8787}`;
  return {
    plugins: [react()],
    build: { chunkSizeWarningLimit: 900 },
    envDir: '..', // lit beatmind/.env (variables VITE_*)
    resolve: { alias: { '@shared': path.resolve(__dirname, '../shared'), '@brand': path.resolve(__dirname, '../brand') } },
    server: {
      port: 5173,
      fs: { allow: ['..'] },
      proxy: {
        '/api': api,
        '/uploads': api,
      },
    },
  };
});
