import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { $fetch, fetch as fetchNuxt, setup } from '@nuxt/test-utils/e2e'
import { parseTarGzip } from 'nanotar'
import { describe, expect, it } from 'vitest'

const SCHEMA_URL = 'https://schemas.agentskills.io/discovery/0.2.0/schema.json'

describe('nuxt-skills production assets', async () => {
  await setup({
    dev: false,
    rootDir: fileURLToPath(new URL('./fixtures/basic', import.meta.url)),
  })

  it('renders the application', async () => {
    expect(await $fetch('/')).toContain('<div>basic</div>')
  })

  it('serves the RFC index with simple and archive entries', async () => {
    const response = await fetchNuxt('/.well-known/agent-skills/index.json')
    const bytes = new Uint8Array(await response.arrayBuffer())
    const index = JSON.parse(new TextDecoder().decode(bytes)) as SkillsIndex

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('application/json')
    expect(response.headers.get('cache-control')).toBe('public, max-age=3600')
    expect(response.headers.get('content-length')).toBe(String(bytes.byteLength))
    expect(response.headers.get('access-control-allow-origin')).toBe('*')
    expect(index.$schema).toBe(SCHEMA_URL)
    expect(index.skills).toEqual([
      {
        description: 'Complex skill with supporting resources.',
        digest: expect.stringMatching(/^sha256:[a-f0-9]{64}$/),
        name: 'complex-skill',
        type: 'archive',
        url: '/.well-known/agent-skills/complex-skill.tar.gz',
      },
      {
        description: 'Test skill exposed by the Nuxt module fixture.',
        digest: expect.stringMatching(/^sha256:[a-f0-9]{64}$/),
        name: 'test-skill',
        type: 'skill-md',
        url: '/.well-known/agent-skills/test-skill/SKILL.md',
      },
    ])
  })

  it('serves the exact simple artifact bytes and digest', async () => {
    const index = await getIndex()
    const entry = index.skills.find(skill => skill.name === 'test-skill')!
    const response = await fetchNuxt(entry.url)
    const bytes = new Uint8Array(await response.arrayBuffer())
    const text = new TextDecoder().decode(bytes)

    expect(response.headers.get('content-type')).toContain('text/markdown')
    expect(response.headers.get('content-length')).toBe(String(bytes.byteLength))
    expect(entry.digest).toBe(digest(bytes))
    expect(text).toContain('name: test-skill')
    expect(text).toContain('# Test Skill')
  })

  it('serves a valid root-level archive with binary integrity', async () => {
    const index = await getIndex()
    const entry = index.skills.find(skill => skill.name === 'complex-skill')!
    const response = await fetchNuxt(entry.url)
    const bytes = new Uint8Array(await response.arrayBuffer())
    const files = await parseTarGzip(bytes)

    expect(response.headers.get('content-type')).toBe('application/gzip')
    expect(entry.digest).toBe(digest(bytes))
    expect(files.map(file => file.name)).toEqual(['SKILL.md', 'assets/data.bin', 'references/guide.txt'])
    expect(new TextDecoder().decode(files.find(file => file.name === 'assets/data.bin')!.data)).toBe('binary\0fixture\n')
    expect(files.every(file => !file.name.startsWith('complex-skill/'))).toBe(true)
  })

  it('supports HEAD and rejects unsupported or invalid requests', async () => {
    const index = await getIndex()
    const entry = index.skills[0]!
    const getResponse = await fetchNuxt(entry.url)
    const headResponse = await fetchNuxt(entry.url, { method: 'HEAD' })

    expect(headResponse.status).toBe(200)
    expect(headResponse.headers.get('content-length')).toBe(getResponse.headers.get('content-length'))
    expect(await headResponse.text()).toBe('')

    const methodResponse = await fetchNuxt('/.well-known/agent-skills/index.json', { method: 'POST' })
    expect(methodResponse.status).toBe(405)
    expect(methodResponse.headers.get('allow')).toBe('GET, HEAD')
    await expectStatus('/.well-known/agent-skills/%E0%A4%A', 400)
    await expectStatus('/.well-known/agent-skills/%2E%2E%2Fsecret', 400)
    await expectStatus('/.well-known/agent-skills/missing.tar.gz', 404)
    const oldRoute = await fetchNuxt('/.well-known/skills/index.json')
    expect(oldRoute.headers.get('content-type')).not.toContain('application/json')
    expect(await oldRoute.text()).not.toContain(SCHEMA_URL)
  })
})

interface SkillsIndex {
  $schema: string
  skills: Array<{
    name: string
    description: string
    type: 'skill-md' | 'archive'
    url: string
    digest: string
  }>
}

async function getIndex(): Promise<SkillsIndex> {
  return await (await fetchNuxt('/.well-known/agent-skills/index.json')).json() as SkillsIndex
}

function digest(bytes: Uint8Array): string {
  return `sha256:${createHash('sha256').update(bytes).digest('hex')}`
}

async function expectStatus(path: string, status: number): Promise<void> {
  expect((await fetchNuxt(path)).status).toBe(status)
}
