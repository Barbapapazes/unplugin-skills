import type { IncomingMessage, ServerResponse } from 'node:http'
import type { ResolvedConfig, ViteDevServer } from 'vite'
import type { ResolvedSkillsPluginOptions, SkillEntry, SkillsIndexPayload, SkillsPluginOptions } from './types.js'
import { readFile } from 'node:fs/promises'
import { join, relative, resolve } from 'node:path'
import process from 'node:process'
import colors from 'picocolors'
import { createUnplugin } from 'unplugin'
import { CACHE_CONTROL_VALUE, DEFAULT_SKILLS_DIR, FILES_ROUTE_PREFIX, INDEX_ROUTE } from './core/constants.js'
import { getContentType } from './core/content-types.js'
import { scanSkills } from './core/scan.js'

function resolveOptions(options: SkillsPluginOptions = {}): ResolvedSkillsPluginOptions {
  return {
    dir: options.dir || DEFAULT_SKILLS_DIR,
  }
}

function getCatalogFileName(skillName: string, fileName: string): string {
  return `.well-known/skills/${skillName}/${fileName}`
}

function isPathTraversal(filePath: string): boolean {
  return filePath.split('/').includes('..')
}

function isHeadRequest(request: IncomingMessage): boolean {
  return request.method === 'HEAD'
}

function isReadRequest(request: IncomingMessage): boolean {
  return request.method === 'GET' || isHeadRequest(request)
}

function sendJson(request: IncomingMessage, response: ServerResponse, payload: SkillsIndexPayload): void {
  response.statusCode = 200
  response.setHeader('content-type', 'application/json; charset=utf-8')
  response.setHeader('cache-control', CACHE_CONTROL_VALUE)
  if (isHeadRequest(request)) {
    response.end()
    return
  }

  response.end(`${JSON.stringify(payload, null, 2)}\n`)
}

function sendText(response: ServerResponse, statusCode: number, message: string): void {
  response.statusCode = statusCode
  response.setHeader('content-type', 'text/plain; charset=utf-8')
  response.end(message)
}

function sendMethodNotAllowed(response: ServerResponse): void {
  response.statusCode = 405
  response.setHeader('allow', 'GET, HEAD')
  response.setHeader('content-type', 'text/plain; charset=utf-8')
  response.end('Method Not Allowed')
}

function isInsideDirectory(directory: string, filePath: string): boolean {
  const relativePath = relative(directory, filePath)
  return relativePath === '' || (!relativePath.startsWith('..') && !relativePath.startsWith('/'))
}

async function getCatalog(skillsRoot: string, warn: (message: string) => void): Promise<SkillsIndexPayload> {
  const skills = await scanSkills(skillsRoot, warn)
  return { skills }
}

function findSkill(catalog: SkillEntry[], skillName: string): SkillEntry | undefined {
  return catalog.find(skill => skill.name === skillName)
}

function getRequestPath(request: IncomingMessage): string {
  return (request.url || '').split('?')[0] || ''
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
      const catalog = await getCatalog(skillsRoot, message => console.warn(`[unplugin-skills] ${message}`))

      if (!catalog.skills.length)
        return

      this.emitFile({
        type: 'asset',
        fileName: '.well-known/skills/index.json',
        source: `${JSON.stringify(catalog, null, 2)}\n`,
      })

      for (const skill of catalog.skills) {
        for (const fileName of skill.files) {
          const source = await readFile(join(skillsRoot, skill.name, fileName))
          this.addWatchFile(join(skillsRoot, skill.name, fileName))
          this.emitFile({
            type: 'asset',
            fileName: getCatalogFileName(skill.name, fileName),
            source,
          })
        }
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
        let catalogCache: SkillsIndexPayload | undefined

        async function getDevCatalog(): Promise<SkillsIndexPayload> {
          catalogCache ||= await getCatalog(skillsRoot, message => server.config.logger.warn(`[unplugin-skills] ${message}`))
          return catalogCache
        }

        server.watcher.add(skillsRoot)
        server.watcher.on('all', (_event, filePath) => {
          if (isInsideDirectory(skillsRoot, filePath))
            catalogCache = undefined
        })

        server.printUrls = () => {
          printUrls()
          printCatalogEndpoint(server)
        }

        server.middlewares.use(async (request: IncomingMessage, response: ServerResponse, next: (err?: unknown) => void) => {
          try {
            const requestPath = getRequestPath(request)
            if (requestPath !== INDEX_ROUTE && !requestPath.startsWith(FILES_ROUTE_PREFIX))
              return next()

            if (!isReadRequest(request)) {
              sendMethodNotAllowed(response)
              return
            }

            const catalog = await getDevCatalog()

            if (requestPath === INDEX_ROUTE) {
              sendJson(request, response, catalog)
              return
            }

            let relativePath = ''

            try {
              relativePath = decodeURIComponent(requestPath.slice(FILES_ROUTE_PREFIX.length))
            }
            catch {
              sendText(response, 400, 'Bad Request')
              return
            }

            if (!relativePath || isPathTraversal(relativePath)) {
              sendText(response, 400, 'Bad Request')
              return
            }

            const [skillName, ...rest] = relativePath.split('/')
            const fileName = rest.join('/')
            const skill = findSkill(catalog.skills, skillName || '')

            if (!skill || !fileName || !skill.files.includes(fileName)) {
              sendText(response, 404, 'Not Found')
              return
            }

            const source = await readFile(join(skillsRoot, skill.name, fileName))
            response.statusCode = 200
            response.setHeader('content-type', getContentType(fileName))
            response.setHeader('cache-control', CACHE_CONTROL_VALUE)
            response.end(isHeadRequest(request) ? undefined : source)
          }
          catch (error) {
            next(error)
          }
        })
      },
    },
  }
})

export { CACHE_CONTROL_VALUE, DEFAULT_SKILLS_DIR, FILES_ROUTE_PREFIX, INDEX_ROUTE, SERVER_ASSETS_BASE_NAME, SKILLS_ROUTE_PREFIX } from './core/constants.js'
export { getContentType } from './core/content-types.js'
export { scanSkills } from './core/scan.js'
export * from './types.js'

export default unplugin
