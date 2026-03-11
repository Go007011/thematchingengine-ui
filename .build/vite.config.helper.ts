import { defineConfig, UserConfig, LibraryFormats } from 'vite'

export interface ViteConfigOptions {
  entry: string
  name: string
  fileName: (format: string) => string
  formats: LibraryFormats[]
  outDir: string
  banner: string
  minify: boolean
}

export const createViteConfig = (options: ViteConfigOptions): UserConfig => {
  return defineConfig({
    build: {
      lib: {
        entry: options.entry,
        name: options.name,
        fileName: options.fileName,
        formats: options.formats
      },
      outDir: options.outDir,
      minify: options.minify,
      rollupOptions: {
        output: {
          banner: options.banner
        }
      }
    }
  })
}
