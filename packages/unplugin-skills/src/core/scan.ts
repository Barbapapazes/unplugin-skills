import type { ScannedSkill, ScannedSkillFile } from '../types.js'
import { open, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import matter from 'gray-matter'

const SKILL_NAME_REGEX = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/
const MAX_NAME_LENGTH = 64
const MAX_DESCRIPTION_LENGTH = 1024
const MAX_TAR_PATH_BYTES = 100
const IGNORED_DIRECTORY_NAMES = new Set(['node_modules', 'dist', '.git', '.cache', '.nuxt', '.output'])

interface SkillFrontmatter {
  name?: string
  description?: string
}

export async function scanSkills(skillsDir: string, warn: (message: string) => void = () => {}): Promise<ScannedSkill[]> {
  let entries
  try {
    entries = await readdir(skillsDir, { withFileTypes: true })
  }
  catch (error) {
    if (isMissingPathError(error))
      return []
    throw error
  }

  const skills: ScannedSkill[] = []

  for (const entry of entries.sort(compareDirectoryEntries)) {
    if (!entry.isDirectory())
      continue

    let files: ScannedSkillFile[]
    try {
      files = await collectFiles(join(skillsDir, entry.name))
    }
    catch (error) {
      warn(`Skipping skill "${entry.name}": ${getErrorMessage(error)}`)
      continue
    }

    const skillMd = files.find(file => file.path === 'SKILL.md')
    if (!skillMd)
      continue

    const frontmatter = parseFrontmatter(new TextDecoder().decode(skillMd.bytes))
    if (!frontmatter) {
      warn(`Skipping skill "${entry.name}": malformed SKILL.md frontmatter`)
      continue
    }

    if (!frontmatter.name) {
      warn(`Skipping skill "${entry.name}": missing name in SKILL.md frontmatter`)
      continue
    }

    if (!validateSkillName(frontmatter.name, entry.name, warn))
      continue

    if (!validateDescription(frontmatter.description, entry.name, warn))
      continue

    skills.push({
      name: frontmatter.name,
      description: frontmatter.description.trim(),
      files,
    })
  }

  return skills
}

async function collectFiles(directory: string, base = ''): Promise<ScannedSkillFile[]> {
  const files: ScannedSkillFile[] = []
  const entries = await readdir(directory, { withFileTypes: true })

  for (const entry of entries.sort(compareDirectoryEntries)) {
    if (entry.name.startsWith('.'))
      continue

    const relativePath = base ? `${base}/${entry.name}` : entry.name
    const sourcePath = join(directory, entry.name)

    if (entry.isSymbolicLink())
      throw new Error(`unsupported symbolic link "${relativePath}"`)

    if (entry.isDirectory()) {
      if (IGNORED_DIRECTORY_NAMES.has(entry.name))
        continue

      files.push(...await collectFiles(sourcePath, relativePath))
      continue
    }

    if (!entry.isFile())
      throw new Error(`unsupported filesystem entry "${relativePath}"`)

    validateArchivePath(relativePath)
    const handle = await open(sourcePath, 'r')
    try {
      const stat = await handle.stat()
      files.push({
        path: relativePath,
        sourcePath,
        bytes: await handle.readFile(),
        mode: stat.mode & 0o777,
      })
    }
    finally {
      await handle.close()
    }
  }

  return files
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

function validateDescription(description: string | undefined, skillName: string, warn: (message: string) => void): description is string {
  if (!description || !description.trim()) {
    warn(`Skipping skill "${skillName}": missing description in SKILL.md frontmatter`)
    return false
  }

  if (description.length > MAX_DESCRIPTION_LENGTH) {
    warn(`Skipping skill "${skillName}": description exceeds ${MAX_DESCRIPTION_LENGTH} character limit`)
    return false
  }

  return true
}

function validateArchivePath(filePath: string): void {
  const segments = filePath.split('/')
  if (filePath.startsWith('/') || filePath.includes('\\') || segments.some(segment => !segment || segment === '.' || segment === '..'))
    throw new Error(`unsafe archive path "${filePath}"`)

  if (new TextEncoder().encode(filePath).byteLength > MAX_TAR_PATH_BYTES)
    throw new Error(`archive path "${filePath}" exceeds ${MAX_TAR_PATH_BYTES} bytes`)
}

function isMissingPathError(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT'
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function compareDirectoryEntries(left: { name: string }, right: { name: string }): number {
  return left.name < right.name ? -1 : left.name > right.name ? 1 : 0
}
