import { fileURLToPath } from 'node:url'
import { $fetch, fetch as fetchNuxt, setup } from '@nuxt/test-utils/e2e'
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
    const response = await fetchNuxt('/.well-known/skills/index.json')
    const catalog = await response.json() as { skills: Array<{ name: string, files: string[] }> }

    expect(response.headers.get('content-type')).toContain('application/json')
    expect(response.headers.get('cache-control')).toBe('public, max-age=3600')
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
    const response = await fetchNuxt('/.well-known/skills/test-skill/SKILL.md')
    const skill = await response.text()

    expect(response.headers.get('content-type')).toContain('text/markdown')
    expect(response.headers.get('cache-control')).toBe('public, max-age=3600')
    expect(skill).toContain('description: Test skill exposed by the Nuxt module fixture.')
    expect(skill).toContain('# Test Skill')
    expect(skill).not.toContain('<div>basic</div>')
  })

  it('rejects invalid skill file requests', async () => {
    await expectStatus('/.well-known/skills/%E0%A4%A', 400)
    await expectStatus('/.well-known/skills/test-skill/missing.txt', 404)
    await expectStatus('/.well-known/skills/test-skill/.hidden.txt', 404)
    await expectStatus('/.well-known/skills/unknown-skill/SKILL.md', 404)
  })
})

async function expectStatus(path: string, status: number): Promise<void> {
  const response = await fetchNuxt(path)
  expect(response.status).toBe(status)
}
