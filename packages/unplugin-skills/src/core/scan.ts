import type { SkillEntry } from '../types.js'
import { constants } from 'node:fs'
import { access, readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import matter from 'gray-matter'

const SKILL_NAME_REGEX = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/
const MAX_NAME_LENGTH = 64
const IGNORED_DIRECTORY_NAMES = new Set(['node_modules', 'dist', '.git', '.cache', '.nuxt', '.output'])

interface SkillFrontmatter {
  name?: string
  description?: string
}

export async function scanSkills(skillsDir: string, warn: (message: string) => void = () => {}): Promise<SkillEntry[]> {
  if (!await pathExists(skillsDir))
    return []

  const catalog: SkillEntry[] = []
  const entries = await readdir(skillsDir, { withFileTypes: true })

  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    if (!entry.isDirectory())
      continue

    const skillDir = join(skillsDir, entry.name)
    const skillMdPath = join(skillDir, 'SKILL.md')

    if (!await pathExists(skillMdPath))
      continue

    const content = await readFile(skillMdPath, 'utf8')
    const frontmatter = parseFrontmatter(content)

    if (!frontmatter?.description) {
      warn(`Skipping skill "${entry.name}": missing description in SKILL.md frontmatter`)
      continue
    }

    const name = frontmatter.name || entry.name
    if (!validateSkillName(name, entry.name, warn))
      continue

    const visibleFiles = (await listFilesRecursively(skillDir))
      .sort((left, right) => left.localeCompare(right))

    const files = ['SKILL.md', ...visibleFiles.filter(file => file !== 'SKILL.md')]

    catalog.push({
      name,
      description: frontmatter.description,
      files,
    })
  }

  return catalog
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath, constants.F_OK)
    return true
  }
  catch {
    return false
  }
}

function parseFrontmatter(content: string): SkillFrontmatter | null {
  try {
    const { data } = matter(content)
    if (!data || typeof data !== 'object')
      return null

    return {
      description: typeof data.description === 'string' ? data.description : undefined,
      name: typeof data.name === 'string' ? data.name : undefined,
    }
  }
  catch {
    return null
  }
}

function validateSkillName(name: string, dirName: string, warn: (message: string) => void): boolean {
  if (name.length > MAX_NAME_LENGTH) {
    warn(`Skill "${name}" exceeds ${MAX_NAME_LENGTH} character limit`)
    return false
  }

  if (!SKILL_NAME_REGEX.test(name) || name.includes('--')) {
    warn(`Skill name "${name}" does not match the Agent Skills naming spec`)
    return false
  }

  if (name !== dirName) {
    warn(`Skill name "${name}" does not match directory name "${dirName}"`)
    return false
  }

  return true
}

async function listFilesRecursively(dir: string, base = ''): Promise<string[]> {
  const files: string[] = []
  const entries = await readdir(dir, { withFileTypes: true })

  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    const relativePath = base ? `${base}/${entry.name}` : entry.name

    if (entry.isDirectory()) {
      if (entry.name.startsWith('.') || IGNORED_DIRECTORY_NAMES.has(entry.name))
        continue

      files.push(...await listFilesRecursively(join(dir, entry.name), relativePath))
      continue
    }

    if (entry.name.startsWith('.'))
      continue

    files.push(relativePath)
  }

  return files
}
