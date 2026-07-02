import type { KnipConfig } from 'knip'

export default {
  ignoreIssues: {
    'packages/unplugin-skills/src/index.ts': ['duplicates'],
    'packages/unplugin-skills/src/vite.ts': ['duplicates'],
  },
  workspaces: {
    '.': {
      entry: ['taze.config.ts'],
    },
    '.playgrounds/vite': {},
    'packages/unplugin-skills': {},
  },
} satisfies KnipConfig
