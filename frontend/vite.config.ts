import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), {
    name: 'local-login-origin',
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        // The local backend accepts localhost:5173 as its exact browser origin.
        // Redirect document navigation only; API origin checks stay unchanged.
        if (request.method === 'GET' && request.headers.host === '127.0.0.1:5173'
            && request.headers.accept?.includes('text/html')) {
          response.writeHead(307, { Location: `http://localhost:5173${request.url ?? '/'}` });
          response.end();
          return;
        }
        next();
      });
    },
  }],
  server: {
    proxy: { '/api': { target: 'http://127.0.0.1:3001', changeOrigin: false } },
    watch: {
      // Wait for file writes to finish before transforming updated modules.
      awaitWriteFinish: { stabilityThreshold: 150, pollInterval: 25 },
    },
  },
})
