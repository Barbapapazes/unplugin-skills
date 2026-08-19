import type { Logger } from 'vite'
import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import { chmod, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { request as createHttpRequest } from 'node:http'
import { dirname, join } from 'node:path'
import { stripVTControlCharacters } from 'node:util'
import { parseTarGzip } from 'nanotar'
import { build, createServer } from 'vite'
import { afterEach, describe, expect, it } from 'vitest'
import { buildSkillsArtifactBundle } from '../src/core/artifacts.js'
import { DISCOVERY_SCHEMA_URL } from '../src/core/constants.js'
import { scanSkills } from '../src/core/scan.js'
import skills from '../src/vite.js'

const tempDirectories: string[] = []

const SIMPLE_SKILL = ['---', 'name: alpha-skill', 'description: Alpha skill', '---', '', '# Alpha'].join('\n')

const tempRoot = join(process.cwd(), 'test/.tmp')

afterEach(async () => {
  await Promise.all(tempDirectories.splice(0).map(directory => rm(directory, { force: true, recursive: true })))
})

describe('skill scanning', () => {
  it('collects sorted immutable files and preserves exclusions', async () => {
    const root = await createFixture({
      'skills/alpha-skill/SKILL.md': SIMPLE_SKILL,
      'skills/alpha-skill/.hidden.txt': 'hidden',
      'skills/alpha-skill/dist/generated.txt': 'generated',
      'skills/alpha-skill/nested/guide.txt': 'guide',
      'skills/alpha-skill/node_modules/dependency.txt': 'dependency',
      'skills/zeta-skill/SKILL.md': ['---', 'name: zeta-skill', 'description: Zeta', '---'].join('\n'),
    })

    const scanned = await scanSkills(join(root, 'skills'))
    expect(scanned.map(skill => ({
      name: skill.name,
      description: skill.description,
      files: skill.files.map(file => file.path),
    }))).toEqual([
      { name: 'alpha-skill', description: 'Alpha skill', files: ['SKILL.md', 'nested/guide.txt'] },
      { name: 'zeta-skill', description: 'Zeta', files: ['SKILL.md'] },
    ])

    await writeFile(join(root, 'skills/alpha-skill/nested/guide.txt'), 'changed')
    expect(new TextDecoder().decode(scanned[0]!.files[1]!.bytes)).toBe('guide')
  })

  it('requires valid explicit metadata', async () => {
    const longName = 'a'.repeat(65)
    const root = await createFixture({
      'skills/missing-name/SKILL.md': ['---', 'description: Missing name', '---'].join('\n'),
      'skills/empty-description/SKILL.md': ['---', 'name: empty-description', 'description: "   "', '---'].join('\n'),
      'skills/mismatch/SKILL.md': ['---', 'name: another-name', 'description: Mismatch', '---'].join('\n'),
      'skills/bad--name/SKILL.md': ['---', 'name: bad--name', 'description: Invalid', '---'].join('\n'),
      [`skills/${longName}/SKILL.md`]: ['---', `name: ${longName}`, 'description: Long', '---'].join('\n'),
      'skills/too-verbose/SKILL.md': ['---', 'name: too-verbose', `description: ${'x'.repeat(1025)}`, '---'].join('\n'),
      'skills/malformed/SKILL.md': ['---', 'name: [', '---'].join('\n'),
    })
    const warnings: string[] = []

    expect(await scanSkills(join(root, 'skills'), warning => warnings.push(warning))).toEqual([])
    expect(warnings.join('\n')).toContain('missing name')
    expect(warnings.join('\n')).toContain('missing description')
    expect(warnings.join('\n')).toContain('does not match directory name')
    expect(warnings.join('\n')).toContain('does not match the Agent Skills naming spec')
    expect(warnings.join('\n')).toContain('exceeds 64 character limit')
    expect(warnings.join('\n')).toContain('exceeds 1024 character limit')
    expect(warnings.join('\n')).toContain('malformed')
  })

  it('rejects symlinks and overlong archive paths for the whole skill', async () => {
    const root = await createFixture({
      'skills/linked-skill/SKILL.md': ['---', 'name: linked-skill', 'description: Linked', '---'].join('\n'),
      'skills/linked-skill/target.txt': 'target',
      'skills/long-path/SKILL.md': ['---', 'name: long-path', 'description: Long path', '---'].join('\n'),
      [`skills/long-path/${'x'.repeat(101)}`]: 'too long',
    })
    await symlink('target.txt', join(root, 'skills/linked-skill/link.txt'))
    const warnings: string[] = []

    expect(await scanSkills(join(root, 'skills'), warning => warnings.push(warning))).toEqual([])
    expect(warnings.join('\n')).toContain('unsupported symbolic link')
    expect(warnings.join('\n')).toContain('exceeds 100 bytes')
  })
})

describe('artifact generation', () => {
  it('publishes untouched SKILL.md bytes and exact digests', async () => {
    const root = await createFixture({ 'skills/alpha-skill/SKILL.md': SIMPLE_SKILL })
    const bundle = await buildSkillsArtifactBundle(join(root, 'skills'))
    const artifact = bundle.artifacts[0]!

    expect(bundle.index).toEqual({
      $schema: DISCOVERY_SCHEMA_URL,
      skills: [{
        name: 'alpha-skill',
        description: 'Alpha skill',
        type: 'skill-md',
        url: '/.well-known/agent-skills/alpha-skill/SKILL.md',
        digest: digest(artifact.bytes),
      }],
    })
    expect(artifact.contentType).toBe('text/markdown; charset=utf-8')
    expect(Buffer.from(artifact.bytes).toString()).toBe(SIMPLE_SKILL)
  })

  it('creates deterministic root-level tar.gz artifacts with modes and binary data', async () => {
    const binary = Uint8Array.from([0, 255, 1, 128])
    const root = await createFixture({
      'skills/alpha-skill/SKILL.md': SIMPLE_SKILL,
      'skills/alpha-skill/assets/data.bin': binary,
      'skills/alpha-skill/scripts/run.sh': '#!/bin/sh\necho alpha\n',
    })
    await chmod(join(root, 'skills/alpha-skill/scripts/run.sh'), 0o755)

    const first = await buildSkillsArtifactBundle(join(root, 'skills'))
    const second = await buildSkillsArtifactBundle(join(root, 'skills'))
    const artifact = first.artifacts[0]!
    const files = await parseTarGzip(artifact.bytes)

    expect(artifact.url).toBe('/.well-known/agent-skills/alpha-skill.tar.gz')
    expect(artifact.contentType).toBe('application/gzip')
    expect(artifact.bytes).toEqual(second.artifacts[0]!.bytes)
    expect(first.index.skills[0]).toMatchObject({ type: 'archive', digest: digest(artifact.bytes) })
    expect(files.map(file => file.name)).toEqual(['SKILL.md', 'assets/data.bin', 'scripts/run.sh'])
    expect(files.find(file => file.name === 'assets/data.bin')!.data).toEqual(binary)
    expect(files.find(file => file.name === 'scripts/run.sh')!.attrs?.mode).toBe('0000755')
    expect(files.every(file => !file.name.startsWith('alpha-skill/'))).toBe(true)
  })
})

describe('vite adapter', () => {
  it('serves exact RFC assets and HTTP semantics in development', async () => {
    const root = await createViteFixture({
      'skills/alpha-skill/SKILL.md': SIMPLE_SKILL,
      'skills/alpha-skill/guide.txt': 'guide',
    })
    const server = await createServer({ appType: 'custom', configFile: false, logLevel: 'silent', plugins: [skills()], root, server: { host: 'localhost', port: 0 } })
    await server.listen(0)

    try {
      const baseUrl = server.resolvedUrls!.local[0]
      const index = await request(baseUrl, '/.well-known/agent-skills/index.json')
      const payload = JSON.parse(index.body.toString())
      const artifact = await request(baseUrl, payload.skills[0].url)
      const head = await request(baseUrl, payload.skills[0].url, 'HEAD')

      expect(index.statusCode).toBe(200)
      expect(index.headers['access-control-allow-origin']).toBe('*')
      expect(index.headers['content-length']).toBe(String(index.body.byteLength))
      expect(payload.$schema).toBe(DISCOVERY_SCHEMA_URL)
      expect(payload.skills[0].digest).toBe(digest(artifact.body))
      expect(artifact.headers['content-type']).toBe('application/gzip')
      expect(head.statusCode).toBe(200)
      expect(head.headers['content-length']).toBe(String(artifact.body.byteLength))
      expect(head.body).toHaveLength(0)
      expect((await request(baseUrl, '/.well-known/agent-skills/index.json', 'POST')).statusCode).toBe(405)
      expect((await request(baseUrl, '/.well-known/agent-skills/%2E%2E/secret')).statusCode).toBe(400)
      expect((await request(baseUrl, '/.well-known/agent-skills/missing.tar.gz')).statusCode).toBe(404)
      expect((await request(baseUrl, '/.well-known/skills/index.json')).statusCode).toBe(404)

      await writeFile(join(root, 'skills/alpha-skill/guide.txt'), 'updated guide')
      await expect.poll(async () => {
        const updated = await request(baseUrl, '/.well-known/agent-skills/index.json')
        return JSON.parse(updated.body.toString()).skills[0].digest
      }).not.toBe(payload.skills[0].digest)
    }
    finally {
      await server.close()
    }
  })

  it('prints the RFC index URL', async () => {
    const root = await createViteFixture({})
    const logs: string[] = []
    const server = await createServer({ configFile: false, customLogger: createTestLogger(logs), plugins: [skills()], root, server: { host: 'localhost', port: 0 } })
    await server.listen(0)
    try {
      server.printUrls()
      expect(logs.map(stripVTControlCharacters)).toContain(`  ➜  Skills:  ${new URL('/.well-known/agent-skills/index.json', server.resolvedUrls!.local[0]).toString()}`)
    }
    finally {
      await server.close()
    }
  })

  it('always emits the index and one artifact per skill during build', async () => {
    const root = await createViteFixture({
      'skills/alpha-skill/SKILL.md': SIMPLE_SKILL,
      'skills/alpha-skill/guide.txt': 'guide',
    })
    await buildVite(root)

    const indexBytes = await readFile(join(root, 'dist/.well-known/agent-skills/index.json'))
    const payload = JSON.parse(indexBytes.toString())
    const artifactBytes = await readFile(join(root, `dist${payload.skills[0].url}`))
    expect(payload.skills[0].digest).toBe(digest(artifactBytes))
    expect(await fileExists(join(root, 'dist/.well-known/skills/index.json'))).toBe(false)

    const emptyRoot = await createViteFixture({})
    await buildVite(emptyRoot)
    expect(JSON.parse(await readFile(join(emptyRoot, 'dist/.well-known/agent-skills/index.json'), 'utf8'))).toEqual({ $schema: DISCOVERY_SCHEMA_URL, skills: [] })
  })
})

async function createViteFixture(files: Record<string, string | Uint8Array>): Promise<string> {
  return createFixture({
    'index.html': '<!doctype html><script type="module" src="/src/main.js"></script>',
    'src/main.js': 'console.log("skills")',
    ...files,
  })
}

async function createFixture(files: Record<string, string | Uint8Array>): Promise<string> {
  await mkdir(tempRoot, { recursive: true })
  const root = await mkdtemp(join(tempRoot, 'unplugin-skills-'))
  tempDirectories.push(root)
  await Promise.all(Object.entries(files).map(async ([relativePath, content]) => {
    const absolutePath = join(root, relativePath)
    await mkdir(dirname(absolutePath), { recursive: true })
    await writeFile(absolutePath, content)
  }))
  return root
}

async function buildVite(root: string): Promise<void> {
  await build({
    appType: 'spa',
    build: { emptyOutDir: true, outDir: 'dist', rollupOptions: { input: 'index.html' } },
    configFile: false,
    logLevel: 'silent',
    plugins: [skills()],
    root,
  })
}

function digest(bytes: Uint8Array): string {
  return `sha256:${createHash('sha256').update(bytes).digest('hex')}`
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await readFile(path)
    return true
  }
  catch {
    return false
  }
}

function createTestLogger(logs: string[]): Logger {
  return {
    clearScreen: () => {},
    error: message => logs.push(message),
    hasErrorLogged: () => false,
    hasWarned: false,
    info: message => logs.push(message),
    warn: message => logs.push(message),
    warnOnce: message => logs.push(message),
  }
}

async function request(baseUrl: string, path: string, method = 'GET'): Promise<{ statusCode: number, headers: Record<string, string>, body: Buffer }> {
  const url = new URL(baseUrl)
  return new Promise((resolve, reject) => {
    const handle = createHttpRequest({ hostname: url.hostname, method, path, port: url.port, protocol: url.protocol }, (response) => {
      const chunks: Buffer[] = []
      response.on('data', chunk => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)))
      response.on('end', () => resolve({
        statusCode: response.statusCode || 0,
        headers: Object.fromEntries(Object.entries(response.headers).map(([key, value]) => [key, Array.isArray(value) ? value.join(', ') : value || ''])),
        body: Buffer.concat(chunks),
      }))
    })
    handle.on('error', reject)
    handle.end()
  })
}
