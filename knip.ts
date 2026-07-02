import type { KnipConfig } from 'knip'

export default {
  ignoreBinaries: ['nuxt'],
  ignoreIssues: {
    'packages/unplugin-skills/src/index.ts': ['duplicates'],
    'packages/unplugin-skills/src/vite.ts': ['duplicates'],
  },
  workspaces: {
    '.': {
      entry: ['taze.config.ts'],
    },
    '.playgrounds/nuxt': {},
    '.playgrounds/vite': {},
    'packages/nuxt-skills': {
      entry: ['src/module.ts', 'src/runtime/server/routes/*.ts', 'test/fixtures/basic/app.vue', 'test/fixtures/basic/nuxt.config.ts'],
      ignoreDependencies: ['nuxt'],
      project: ['src/**/*.ts', 'test/**/*.ts', 'test/fixtures/**/*'],
    },
    'packages/unplugin-skills': {},
  },
} satisfies KnipConfig
