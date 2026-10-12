import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { copyFileSync, existsSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'

// Every fixed route in src/App.tsx (/records/:id/print falls back to 404.html).
const SPA_ROUTES = ['student', 'teacher', 'teacher/classes', 'cr', 'timetable', 'admin', 'admin-demo', 'alumni']

export default defineConfig({
  base: '/records/',

  plugins: [
    react(),

    {
      name: 'spa-fallback',

      // Static hosts (GitHub Pages, Render) don't know the app's client-side
      // routes, so refreshing /student or /admin would show "Not Found".
      // Give each route its own copy of index.html, plus a 404.html fallback.
      closeBundle() {
        const dist = resolve(process.cwd(), 'dist')
        const indexFile = resolve(dist, 'index.html')
        if (!existsSync(indexFile)) return

        copyFileSync(indexFile, resolve(dist, '404.html'))
        for (const route of SPA_ROUTES) {
          const dir = resolve(dist, route)
          mkdirSync(dir, { recursive: true })
          copyFileSync(indexFile, resolve(dir, 'index.html'))
        }
        console.log(`SPA fallback: 404.html + ${SPA_ROUTES.length} route pages`)
      },
    },
  ],
})