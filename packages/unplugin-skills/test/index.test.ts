import type { Logger } from 'vite'
import { Buffer } from 'node:buffer'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { get } from 'node:http'
import { dirname, join } from 'node:path'
import { stripVTControlCharacters } from 'node:util'
import { build, createServer } from 'vite'
import { afterEach, describe, expect, it } from 'vitest'
import { scanSkills } from '../src/core/scan.js'
import skills from '../src/vite.js'

const tempDirectories: string[] = []

afterEach(async () => {
  await Promise.all(tempDirectories.splice(0).map(directory => rm(directory, { force: true, recursive: true })))
})

describe('unplugin-skills', () => {
  it('scans valid skills and skips invalid entries', async () => {
    const root = await createFixture({
      'skills/alpha-skill/SKILL.md': ['---', 'name: alpha-skill', 'description: Alpha skill', '---', '', 'Alpha'].join('\n'),
      'skills/alpha-skill/.hidden.txt': 'shh',
      'skills/alpha-skill/nested/guide.txt': 'hello',
      'skills/bad--skill/SKILL.md': ['---', 'name: bad--skill', 'description: Invalid', '---'].join('\n'),
      'skills/mismatch-name/SKILL.md': ['---', 'name: another-name', 'description: Invalid', '---'].join('\n'),
      'skills/missing-description/SKILL.md': ['---', 'name: missing-description', '---'].join('\n'),
      'skills/not-a-skill/readme.md': 'ignored',
    })

    const warnings: string[] = []
    const catalog = await scanSkills(join(root, 'skills'), message => warnings.push(message))

    expect(catalog).toEqual([
      {
        name: 'alpha-skill',
        description: 'Alpha skill',
        files: ['SKILL.md', 'nested/guide.txt'],
      },
    ])
    expect(warnings).toHaveLength(3)
    expect(warnings.join('\n')).toContain('missing description')
    expect(warnings.join('\n')).toContain('does not match the Agent Skills naming spec')
    expect(warnings.join('\n')).toContain('does not match directory name')
  })

  it('parses SKILL.md frontmatter', async () => {
    const root = await createFixture({
      'skills/multiline-skill/SKILL.md': ['---', 'name: multiline-skill', 'description: >', '  Multiline skill', '  description', '---', '', '# Multiline skill', '', '---', '', 'Body delimiter should stay content.'].join('\n'),
    })

    const catalog = await scanSkills(join(root, 'skills'))

    expect(catalog).toEqual([
      {
        name: 'multiline-skill',
        description: 'Multiline skill description\n',
        files: ['SKILL.md'],
      },
    ])
  })

  it('serves skills endpoints in dev', async () => {
    const root = await createFixture({
      'index.html': '<!doctype html><html><body><div id="app"></div><script type="module" src="/src/main.js"></script></body></html>',
      'src/main.js': 'console.log("dev")',
      'skills/alpha-skill/SKILL.md': ['---', 'name: alpha-skill', 'description: Alpha skill', '---', '', 'Alpha'].join('\n'),
      'skills/alpha-skill/prompts/guide.txt': 'Follow the alpha guide',
    })

    const server = await createServer({
      configFile: false,
      logLevel: 'silent',
      plugins: [skills()],
      root,
      server: {
        host: 'localhost',
        port: 0,
      },
    })

    await server.listen(0)

    try {
      const baseUrl = server.resolvedUrls!.local[0]
      expect(baseUrl).toBeTruthy()

      const indexResponse = await request(baseUrl, '/.well-known/skills/index.json')
      const fileResponse = await request(baseUrl, '/.well-known/skills/alpha-skill/prompts/guide.txt')
      const traversalResponse = await request(baseUrl, '/.well-known/skills/%2E%2E/secret.txt')

      expect(indexResponse.statusCode).toBe(200)
      expect(indexResponse.headers['content-type']).toContain('application/json')
      expect(indexResponse.headers['cache-control']).toBe('public, max-age=3600')
      expect(JSON.parse(indexResponse.body)).toEqual({
        skills: [
          {
            name: 'alpha-skill',
            description: 'Alpha skill',
            files: ['SKILL.md', 'prompts/guide.txt'],
          },
        ],
      })

      expect(fileResponse.statusCode).toBe(200)
      expect(fileResponse.headers['content-type']).toContain('text/plain')
      expect(fileResponse.body).toBe('Follow the alpha guide')

      expect(traversalResponse.statusCode).toBe(400)
    }
    finally {
      await server.close()
    }
  })

  it('prints the skills catalog endpoint with the dev server urls', async () => {
    const root = await createFixture({
      'index.html': '<!doctype html><html><body><div id="app"></div><script type="module" src="/src/main.js"></script></body></html>',
      'src/main.js': 'console.log("dev")',
    })
    const logs: string[] = []

    const server = await createServer({
      configFile: false,
      customLogger: createTestLogger(logs),
      plugins: [skills()],
      root,
      server: {
        host: 'localhost',
        port: 0,
      },
    })

    await server.listen(0)

    try {
      const baseUrl = server.resolvedUrls!.local[0]
      server.printUrls()

      expect(logs.map(log => stripVTControlCharacters(log))).toContain(`  ➜  Skills:  ${new URL('/.well-known/skills/index.json', baseUrl).toString()}`)
    }
    finally {
      await server.close()
    }
  })

  it('emits skills assets during build', async () => {
    const root = await createFixture({
      'index.html': '<!doctype html><html><body><div id="app"></div><script type="module" src="/src/main.js"></script></body></html>',
      'src/main.js': 'console.log("build")',
      'skills/alpha-skill/SKILL.md': ['---', 'name: alpha-skill', 'description: Alpha skill', '---', '', 'Alpha'].join('\n'),
      'skills/alpha-skill/prompts/guide.txt': 'Follow the alpha guide',
    })

    const outputDirectory = join(root, 'dist')

    await build({
      appType: 'spa',
      build: {
        emptyOutDir: true,
        outDir: 'dist',
        rollupOptions: {
          input: 'index.html',
        },
      },
      configFile: false,
      logLevel: 'silent',
      plugins: [skills()],
      root,
    })

    const indexContent = await readFile(join(outputDirectory, '.well-known/skills/index.json'), 'utf8')
    const fileContent = await readFile(join(outputDirectory, '.well-known/skills/alpha-skill/prompts/guide.txt'), 'utf8')

    expect(JSON.parse(indexContent)).toEqual({
      skills: [
        {
          name: 'alpha-skill',
          description: 'Alpha skill',
          files: ['SKILL.md', 'prompts/guide.txt'],
        },
      ],
    })
    expect(fileContent).toBe('Follow the alpha guide')
  })
})

async function createFixture(files: Record<string, string>): Promise<string> {
  const fixtureRoot = join(process.cwd(), 'test/.tmp')
  await mkdir(fixtureRoot, { recursive: true })

  const root = await mkdtemp(join(fixtureRoot, 'unplugin-skills-'))
  tempDirectories.push(root)

  await Promise.all(Object.entries(files).map(async ([relativePath, content]) => {
    const absolutePath = join(root, relativePath)
    await mkdir(dirname(absolutePath), { recursive: true })
    await writeFile(absolutePath, content, 'utf8')
  }))

  return root
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

async function request(baseUrl: string, path: string): Promise<{ statusCode: number, headers: Record<string, string>, body: string }> {
  const url = new URL(baseUrl)

  return new Promise((resolve, reject) => {
    const requestHandle = get({
      hostname: url.hostname,
      path,
      port: url.port,
      protocol: url.protocol,
    }, (response) => {
      const chunks: Buffer[] = []
      response.on('data', chunk => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)))
      response.on('end', () => {
        resolve({
          statusCode: response.statusCode || 0,
          headers: Object.fromEntries(Object.entries(response.headers).map(([key, value]) => [key, Array.isArray(value) ? value.join(', ') : value || ''])),
          body: Buffer.concat(chunks).toString('utf8'),
        })
      })
    })

    requestHandle.on('error', reject)
  })
}
