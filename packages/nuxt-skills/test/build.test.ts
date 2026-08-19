import { execFile } from 'node:child_process'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { afterAll, describe, expect, it } from 'vitest'

const execFileAsync = promisify(execFile)
const temporaryDirectories: string[] = []

afterAll(async () => {
  await Promise.all(temporaryDirectories.map(directory => rm(directory, { force: true, recursive: true })))
})

describe('production build', () => {
  it('keeps generated server assets after Nuxt cleans its build directory', async () => {
    const root = await createFixture()
    const nuxtCli = fileURLToPath(new URL('../node_modules/nuxt/bin/nuxt.mjs', import.meta.url))

    await execFileAsync(process.execPath, [nuxtCli, 'build'], {
      cwd: root,
      env: { ...process.env, NO_COLOR: '1' },
      maxBuffer: 10 * 1024 * 1024,
    })

    const index = JSON.parse(await readFile(join(root, '.output/public/.well-known/agent-skills/index.json'), 'utf8'))
    expect(index.skills).toEqual([
      expect.objectContaining({
        name: 'build-skill',
        type: 'archive',
        url: '/.well-known/agent-skills/build-skill.tar.gz',
      }),
    ])
  }, 30_000)
})

async function createFixture(): Promise<string> {
  const fixtureRoot = join(process.cwd(), 'test/.tmp')
  await mkdir(fixtureRoot, { recursive: true })
  const root = await mkdtemp(join(fixtureRoot, 'nuxt-skills-build-'))
  temporaryDirectories.push(root)

  const modulePath = fileURLToPath(new URL('../src/module.ts', import.meta.url))
  const files: Record<string, string> = {
    'app/app.vue': '<template><div>build fixture</div></template>',
    'nuxt.config.ts': `import SkillsModule from ${JSON.stringify(modulePath)}\n\nexport default defineNuxtConfig({\n  compatibilityDate: '2025-07-15',\n  modules: [SkillsModule],\n})\n`,
    'package.json': '{"private":true,"type":"module"}\n',
    'skills/build-skill/SKILL.md': ['---', 'name: build-skill', 'description: Production build fixture.', '---', '', '# Build Skill'].join('\n'),
    'skills/build-skill/reference.txt': 'Supporting file.\n',
  }

  await Promise.all(Object.entries(files).map(async ([relativePath, content]) => {
    const destination = join(root, relativePath)
    await mkdir(dirname(destination), { recursive: true })
    await writeFile(destination, content)
  }))

  return root
}
