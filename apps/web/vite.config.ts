import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

const worker = 'http://localhost:8787';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // injectManifest: we ship our own service worker (src/sw.ts) because it also handles push.
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'autoUpdate',
      injectManifest: { globPatterns: ['**/*.{js,css,html,png,woff2}'] },
      manifest: {
        name: 'PARC FERMÉ',
        short_name: 'PARC FERMÉ',
        description: "Retro-arcade F1 pick'em league",
        theme_color: '#05050a',
        background_color: '#05050a',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
  server: {
    // In dev the API, share page and card image come from `wrangler dev`.
    proxy: { '/api': worker, '/card': worker, '/share': worker },
  },
});
