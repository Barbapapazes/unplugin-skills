import type { NitroConfig } from 'nitropack'
import type { SkillsPluginOptions } from 'unplugin-skills/types'
import { resolve } from 'node:path'
import { addPrerenderRoutes, addServerHandler, createResolver, defineNuxtModule } from '@nuxt/kit'
import { DEFAULT_SKILLS_DIR, INDEX_ROUTE, scanSkills, SERVER_ASSETS_BASE_NAME, SKILLS_ROUTE_PREFIX } from 'unplugin-skills'

export type ModuleOptions = SkillsPluginOptions

interface RuntimeSkillsConfig {
  catalog: Awaited<ReturnType<typeof scanSkills>>
}

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
    const catalog = await scanSkills(skillsRoot, message => console.warn(`[nuxt-skills] ${message}`))
    const { resolve: resolveRuntime } = createResolver(import.meta.url)

    nuxt.options.runtimeConfig.skills = { catalog } satisfies RuntimeSkillsConfig

    const prerenderRoutes = [INDEX_ROUTE]
    for (const skill of catalog) {
      for (const fileName of skill.files)
        prerenderRoutes.push(`${SKILLS_ROUTE_PREFIX}/${skill.name}/${fileName}`)
    }

    addPrerenderRoutes(prerenderRoutes)

    const onNitroConfig = nuxt.hook as (name: 'nitro:config', cb: (nitroConfig: NitroConfig) => void) => void
    onNitroConfig('nitro:config', (nitroConfig) => {
      nitroConfig.serverAssets ||= []
      nitroConfig.serverAssets.push({ baseName: SERVER_ASSETS_BASE_NAME, dir: skillsRoot })
    })

    addServerHandler({
      route: INDEX_ROUTE,
      handler: resolveRuntime('./runtime/server/routes/skills-index'),
    })

    addServerHandler({
      route: `${SKILLS_ROUTE_PREFIX}/**`,
      handler: resolveRuntime('./runtime/server/routes/skills-files'),
    })
  },
})

declare module 'nuxt/schema' {
  interface RuntimeConfig {
    skills: RuntimeSkillsConfig
  }
}
