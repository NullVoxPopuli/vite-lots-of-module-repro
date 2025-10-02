import { defineConfig } from 'vite';
import mkcert from 'vite-plugin-mkcert';
import { h2proxy } from './http2-proxy.js';

export default defineConfig(() => ({
  plugins: [
    // Not needed to reproduce the issue
    // h2proxy(),
    mkcert({
      savePath: 'node_modules/.vite-plugin-mkcert/',
    }),
  ],
}));
