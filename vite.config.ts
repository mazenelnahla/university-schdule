import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import { defineConfig } from 'vite'
import fs from 'node:fs'
import path from 'node:path'

const databasePath = path.resolve(process.cwd(), 'data', 'university_schedule.sqlite')

export default defineConfig({
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] }),
    {
      name: 'local-sqlite-database',
      configureServer(server) {
        server.middlewares.use('/api/database', (req, res, next) => {
          fs.mkdirSync(path.dirname(databasePath), { recursive: true })

          if (req.method === 'GET') {
            if (!fs.existsSync(databasePath)) {
              res.statusCode = 404
              res.end('Database file does not exist')
              return
            }
            res.statusCode = 200
            res.setHeader('Content-Type', 'application/x-sqlite3')
            fs.createReadStream(databasePath).pipe(res)
            return
          }

          if (req.method === 'PUT' || req.method === 'POST') {
            const chunks: Buffer[] = []
            req.on('data', (chunk: Buffer) => chunks.push(chunk))
            req.on('end', () => {
              fs.writeFileSync(databasePath, Buffer.concat(chunks))
              res.statusCode = 204
              res.end()
            })
            req.on('error', next)
            return
          }

          res.statusCode = 405
          res.setHeader('Allow', 'GET, PUT, POST')
          res.end('Method not allowed')
        })
      },
    },
  ],
  assetsInclude: ['**/*.wasm'],
})
