import { copyFileSync, mkdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const distDir = join(process.cwd(), 'dist')

console.log('Preparing distribution files...')

if (!existsSync(distDir)) {
  console.log('No dist directory found, skipping preparation.')
  process.exit(0)
}

console.log('Distribution preparation complete.')
