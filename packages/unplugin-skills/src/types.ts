export interface SkillEntry {
  name: string
  description: string
  type: 'skill-md' | 'archive'
  url: string
  digest: `sha256:${string}`
}

export interface SkillsIndexPayload {
  $schema: string
  skills: SkillEntry[]
}

export interface ScannedSkillFile {
  path: string
  sourcePath: string
  bytes: Uint8Array
  mode: number
}

export interface ScannedSkill {
  name: string
  description: string
  files: ScannedSkillFile[]
}

export interface SkillArtifact {
  path: string
  url: string
  contentType: string
  bytes: Uint8Array
}

export interface SkillsArtifactBundle {
  index: SkillsIndexPayload
  indexBytes: Uint8Array
  artifacts: SkillArtifact[]
  watchFiles: string[]
}

export interface SkillsPluginOptions {
  dir?: string
}

export interface ResolvedSkillsPluginOptions {
  dir: string
}
