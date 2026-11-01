import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Applied to the production build only: the dev server and Puppeteer smoke
// tests rely on inline/eval execution, while the shipped APK and static build
// get a locked-down policy.
const CSP =
  "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; " +
  "img-src 'self' blob: data:; font-src 'self' data:; connect-src 'self'; " +
  "object-src 'none'; base-uri 'self'; form-action 'self'"

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'clarity-csp',
      apply: 'build',
      transformIndexHtml() {
        return [
          {
            tag: 'meta',
            attrs: { 'http-equiv': 'Content-Security-Policy', content: CSP },
            injectTo: 'head-prepend',
          },
        ]
      },
    },
  ],
  server: {
    port: 5173,
    host: true,
  },
})
