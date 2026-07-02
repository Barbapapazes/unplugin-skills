import { fileURLToPath } from 'node:url'
import { $fetch, setup } from '@nuxt/test-utils/e2e'
import { describe, expect, it } from 'vitest'

describe('ssr', async () => {
  await setup({
    dev: true,
    rootDir: fileURLToPath(new URL('./fixtures/basic', import.meta.url)),
  })

  it('renders the index page', async () => {
    // Get response to a server-rendered page with `$fetch`.
    const html = await $fetch('/')
    expect(html).toContain('<div>basic</div>')
  })

  it('serves the skills catalog', async () => {
    const catalog = await $fetch<{ skills: Array<{ name: string, files: string[] }> }>('/.well-known/skills/index.json')

    expect(catalog).toEqual({
      skills: [
        {
          description: 'Test skill exposed by the Nuxt module fixture.',
          name: 'test-skill',
          files: ['SKILL.md'],
        },
      ],
    })
  })

  it('serves skill files as static assets', async () => {
    const skill = await $fetch<string>('/.well-known/skills/test-skill/SKILL.md')

    expect(skill).toContain('description: Test skill exposed by the Nuxt module fixture.')
    expect(skill).toContain('# Test Skill')
    expect(skill).not.toContain('<div>basic</div>')
  })
})
