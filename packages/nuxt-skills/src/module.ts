import type { Nitro, NitroConfig, PrerenderRoute } from 'nitropack'
import type { SkillsPluginOptions } from 'unplugin-skills/types'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { addPrerenderRoutes, addServerHandler, createResolver, defineNuxtModule } from '@nuxt/kit'
import { buildSkillsArtifactBundle, CACHE_CONTROL_VALUE, DEFAULT_SKILLS_DIR, GENERATED_ASSETS_DIR, INDEX_ROUTE, SERVER_ASSETS_BASE_NAME, SKILLS_ROUTE_PREFIX } from 'unplugin-skills'

export type ModuleOptions = SkillsPluginOptions

function resolveOptions(options: ModuleOptions): Required<ModuleOptions> {
  return {
    dir: options.dir || DEFAULT_SKILLS_DIR,
  }
}

export default defineNuxtModule<ModuleOptions>({
  meta: {
    name: 'nuxt-skills',
    configKey: 'skills',
    compatibility: {
      nuxt: '>=4.0.0',
    },
  },
  defaults: {},
  async setup(options, nuxt) {
    const resolvedOptions = resolveOptions(options)
    const skillsRoot = resolve(nuxt.options.rootDir, resolvedOptions.dir)
    const generatedAssetsDir = resolve(nuxt.options.buildDir, GENERATED_ASSETS_DIR)
    const bundle = await buildSkillsArtifactBundle(skillsRoot, message => console.warn(`[nuxt-skills] ${message}`))
    const { resolve: resolveRuntime } = createResolver(import.meta.url)

    addPrerenderRoutes([INDEX_ROUTE, ...bundle.artifacts.map(artifact => artifact.url)])

    const onNitroConfig = nuxt.hook as (name: 'nitro:config', cb: (nitroConfig: NitroConfig) => void) => void
    onNitroConfig('nitro:config', (nitroConfig) => {
      nitroConfig.serverAssets ||= []
      nitroConfig.serverAssets.push({ baseName: SERVER_ASSETS_BASE_NAME, dir: generatedAssetsDir })
      nitroConfig.hooks ||= {}
      const buildHooks = nitroConfig.hooks as unknown as Record<string, ((nitro: Nitro) => void | Promise<void>) | undefined>
      const previousBuildBeforeHook = buildHooks['build:before']
      buildHooks['build:before'] = async (nitro) => {
        await previousBuildBeforeHook?.(nitro)
        await rm(generatedAssetsDir, { force: true, recursive: true })
        await mkdir(generatedAssetsDir, { recursive: true })
        await writeGeneratedAsset(generatedAssetsDir, 'index.json', bundle.indexBytes)
        await Promise.all(bundle.artifacts.map(artifact => writeGeneratedAsset(generatedAssetsDir, artifact.path, artifact.bytes)))
      }

      const hooks = nitroConfig.hooks as unknown as Record<string, ((route: PrerenderRoute) => void | Promise<void>) | undefined>
      const previousPrerenderRouteHook = hooks['prerender:generate']
      hooks['prerender:generate'] = async (route) => {
        await previousPrerenderRouteHook?.(route)
        if (route.route.startsWith(`${SKILLS_ROUTE_PREFIX}/`) && route.route.endsWith('.tar.gz'))
          route.skip = true
      }
      nitroConfig.routeRules ||= {}
      nitroConfig.routeRules[`${SKILLS_ROUTE_PREFIX}/**`] = {
        ...nitroConfig.routeRules[`${SKILLS_ROUTE_PREFIX}/**`],
        headers: {
          ...nitroConfig.routeRules[`${SKILLS_ROUTE_PREFIX}/**`]?.headers,
          'access-control-allow-origin': '*',
          'cache-control': CACHE_CONTROL_VALUE,
        },
      }
    })

    addServerHandler({
      route: INDEX_ROUTE,
      handler: resolveRuntime('./runtime/server/routes/skills-index'),
    })

    addServerHandler({
      route: `${SKILLS_ROUTE_PREFIX}/**`,
      handler: resolveRuntime('./runtime/server/routes/skills-artifacts'),
    })
  },
})

async function writeGeneratedAsset(root: string, relativePath: string, bytes: Uint8Array): Promise<void> {
  const destination = resolve(root, relativePath)
  await mkdir(dirname(destination), { recursive: true })
  await writeFile(destination, bytes)
}
