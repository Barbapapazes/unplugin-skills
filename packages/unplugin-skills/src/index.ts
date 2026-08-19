import type { IncomingMessage, ServerResponse } from 'node:http'
import type { ResolvedConfig, ViteDevServer } from 'vite'
import type { ResolvedSkillsPluginOptions, SkillArtifact, SkillsArtifactBundle, SkillsPluginOptions } from './types.js'
import { relative, resolve } from 'node:path'
import process from 'node:process'
import colors from 'picocolors'
import { createUnplugin } from 'unplugin'
import { buildSkillsArtifactBundle, getBundleAsset } from './core/artifacts.js'
import { CACHE_CONTROL_VALUE, DEFAULT_SKILLS_DIR, INDEX_ROUTE, SKILLS_ROUTE_PREFIX } from './core/constants.js'

function resolveOptions(options: SkillsPluginOptions = {}): ResolvedSkillsPluginOptions {
  return {
    dir: options.dir || DEFAULT_SKILLS_DIR,
  }
}

function isHeadRequest(request: IncomingMessage): boolean {
  return request.method === 'HEAD'
}

function isReadRequest(request: IncomingMessage): boolean {
  return request.method === 'GET' || isHeadRequest(request)
}

function sendMethodNotAllowed(response: ServerResponse): void {
  response.statusCode = 405
  response.setHeader('allow', 'GET, HEAD')
  response.setHeader('content-type', 'text/plain; charset=utf-8')
  response.end('Method Not Allowed')
}

function sendText(response: ServerResponse, statusCode: number, message: string): void {
  response.statusCode = statusCode
  response.setHeader('content-type', 'text/plain; charset=utf-8')
  response.end(message)
}

function sendAsset(request: IncomingMessage, response: ServerResponse, asset: SkillArtifact): void {
  response.statusCode = 200
  response.setHeader('content-type', asset.contentType)
  response.setHeader('cache-control', CACHE_CONTROL_VALUE)
  response.setHeader('content-length', String(asset.bytes.byteLength))
  response.setHeader('access-control-allow-origin', '*')
  response.end(isHeadRequest(request) ? undefined : asset.bytes)
}

function isInsideDirectory(directory: string, filePath: string): boolean {
  const relativePath = relative(directory, filePath)
  return relativePath === '' || (!relativePath.startsWith('..') && !relativePath.startsWith('/'))
}

function getRequestPath(request: IncomingMessage): string {
  return (request.url || '').split('?')[0] || ''
}

function decodeRequestPath(requestPath: string): string | undefined {
  try {
    return decodeURIComponent(requestPath)
  }
  catch {
    return undefined
  }
}

function hasTraversal(requestPath: string): boolean {
  return requestPath.split('/').some(segment => segment === '.' || segment === '..') || requestPath.includes('\\')
}

function getCatalogEndpoint(server: ViteDevServer): string {
  const baseUrl = server.resolvedUrls?.local[0] || server.resolvedUrls?.network[0]
  return baseUrl ? new URL(INDEX_ROUTE, baseUrl).toString() : INDEX_ROUTE
}

function colorUrl(url: string): string {
  return colors.cyan(url.replace(/:(\d+)\//, (_, port) => `:${colors.bold(port)}/`))
}

function printCatalogEndpoint(server: ViteDevServer): void {
  server.config.logger.info(`  ${colors.green('➜')}  ${colors.bold('Skills')}:  ${colorUrl(getCatalogEndpoint(server))}`)
}

export const unplugin = createUnplugin<SkillsPluginOptions | undefined>((userOptions = {}, meta) => {
  const options = resolveOptions(userOptions)
  let root = process.cwd()
  let command: 'build' | 'serve' = meta.framework === 'vite' ? 'serve' : 'build'

  return {
    name: 'unplugin-skills',
    async buildStart() {
      if (command !== 'build')
        return

      const skillsRoot = resolve(root, options.dir)
      const bundle = await buildSkillsArtifactBundle(skillsRoot, message => console.warn(`[unplugin-skills] ${message}`))

      for (const filePath of bundle.watchFiles)
        this.addWatchFile(filePath)

      this.emitFile({
        type: 'asset',
        fileName: INDEX_ROUTE.slice(1),
        source: bundle.indexBytes,
      })

      for (const artifact of bundle.artifacts) {
        this.emitFile({
          type: 'asset',
          fileName: artifact.url.slice(1),
          source: artifact.bytes,
        })
      }
    },
    vite: {
      configResolved(config: ResolvedConfig) {
        command = config.command
        root = config.root
      },
      configureServer(server: ViteDevServer) {
        const printUrls = server.printUrls.bind(server)
        const skillsRoot = resolve(root, options.dir)
        let bundleCache: SkillsArtifactBundle | undefined
        let bundlePromise: Promise<SkillsArtifactBundle> | undefined
        let regenerationRequested = false

        function generateBundle(): Promise<SkillsArtifactBundle> {
          if (bundlePromise) {
            regenerationRequested = true
            return bundlePromise
          }

          bundlePromise = buildSkillsArtifactBundle(skillsRoot, message => server.config.logger.warn(`[unplugin-skills] ${message}`))
            .then((bundle) => {
              bundleCache = bundle
              return bundle
            })
            .finally(() => {
              bundlePromise = undefined
              if (regenerationRequested) {
                regenerationRequested = false
                void generateBundle().catch(error => server.config.logger.error(`[unplugin-skills] Failed to regenerate skills: ${String(error)}`))
              }
            })
          return bundlePromise
        }

        async function getDevBundle(): Promise<SkillsArtifactBundle> {
          return bundlePromise || bundleCache || generateBundle()
        }

        server.watcher.add(skillsRoot)
        server.watcher.on('all', (_event, filePath) => {
          if (isInsideDirectory(skillsRoot, filePath))
            void generateBundle().catch(error => server.config.logger.error(`[unplugin-skills] Failed to regenerate skills: ${String(error)}`))
        })

        server.printUrls = () => {
          printUrls()
          printCatalogEndpoint(server)
        }

        server.middlewares.use(async (request: IncomingMessage, response: ServerResponse, next: (err?: unknown) => void) => {
          try {
            const rawPath = getRequestPath(request)
            if (rawPath !== INDEX_ROUTE && !rawPath.startsWith(`${SKILLS_ROUTE_PREFIX}/`))
              return next()

            if (!isReadRequest(request)) {
              sendMethodNotAllowed(response)
              return
            }

            const requestPath = decodeRequestPath(rawPath)
            if (!requestPath || hasTraversal(requestPath)) {
              sendText(response, 400, 'Bad Request')
              return
            }

            const asset = getBundleAsset(await getDevBundle(), requestPath)
            if (!asset) {
              sendText(response, 404, 'Not Found')
              return
            }

            sendAsset(request, response, asset)
          }
          catch (error) {
            next(error)
          }
        })
      },
    },
  }
})

export { buildArtifactBundle, buildSkillsArtifactBundle, getBundleAsset } from './core/artifacts.js'
export { CACHE_CONTROL_VALUE, DEFAULT_SKILLS_DIR, DISCOVERY_SCHEMA_URL, GENERATED_ASSETS_DIR, INDEX_ROUTE, SERVER_ASSETS_BASE_NAME, SKILLS_ROUTE_PREFIX } from './core/constants.js'
export { getContentType } from './core/content-types.js'
export { scanSkills } from './core/scan.js'
export * from './types.js'

export default unplugin
