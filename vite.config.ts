import { defineConfig } from 'vite';
import { cloudflare } from '@cloudflare/vite-plugin';

export default defineConfig({
  plugins: [cloudflare({ viteEnvironment: { name: 'worker' } })],
  server: { port: 3000, strictPort: true },
  preview: { port: 3000, strictPort: true },
});
