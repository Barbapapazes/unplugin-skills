import type { ScannedSkill, SkillArtifact, SkillEntry, SkillsArtifactBundle, SkillsIndexPayload } from '../types.js'
import { createHash } from 'node:crypto'
import { createTarGzip } from 'nanotar'
import { DISCOVERY_SCHEMA_URL, INDEX_ROUTE, SKILLS_ROUTE_PREFIX } from './constants.js'
import { getContentType } from './content-types.js'
import { scanSkills } from './scan.js'

const encoder = new TextEncoder()

export async function buildSkillsArtifactBundle(skillsDir: string, warn: (message: string) => void = () => {}): Promise<SkillsArtifactBundle> {
  return buildArtifactBundle(await scanSkills(skillsDir, warn))
}

export async function buildArtifactBundle(skills: ScannedSkill[]): Promise<SkillsArtifactBundle> {
  const entries: SkillEntry[] = []
  const artifacts: SkillArtifact[] = []

  for (const skill of skills) {
    const isSkillMd = skill.files.length === 1 && skill.files[0]?.path === 'SKILL.md'
    const artifactPath = isSkillMd ? `${skill.name}/SKILL.md` : `${skill.name}.tar.gz`
    const url = `${SKILLS_ROUTE_PREFIX}/${artifactPath}`
    const bytes = isSkillMd
      ? skill.files[0]!.bytes
      : await createTarGzip(skill.files.map(file => ({
          name: file.path,
          data: file.bytes,
          attrs: { mode: file.mode.toString(8).padStart(3, '0') },
        })), {
          attrs: {
            gid: 0,
            group: '',
            mtime: 0,
            uid: 0,
            user: '',
          },
        })

    entries.push({
      name: skill.name,
      description: skill.description,
      type: isSkillMd ? 'skill-md' : 'archive',
      url,
      digest: `sha256:${createHash('sha256').update(bytes).digest('hex')}`,
    })
    artifacts.push({
      path: artifactPath,
      url,
      contentType: getContentType(artifactPath),
      bytes,
    })
  }

  const index: SkillsIndexPayload = {
    $schema: DISCOVERY_SCHEMA_URL,
    skills: entries,
  }

  return {
    index,
    indexBytes: encoder.encode(`${JSON.stringify(index, null, 2)}\n`),
    artifacts,
    watchFiles: skills.flatMap(skill => skill.files.map(file => file.sourcePath)),
  }
}

export function getBundleAsset(bundle: SkillsArtifactBundle, url: string): SkillArtifact | undefined {
  if (url === INDEX_ROUTE) {
    return {
      path: 'index.json',
      url: INDEX_ROUTE,
      contentType: 'application/json; charset=utf-8',
      bytes: bundle.indexBytes,
    }
  }

  return bundle.artifacts.find(artifact => artifact.url === url)
}
