export interface SkillEntry {
  name: string
  description: string
  files: string[]
}

export interface SkillsIndexPayload {
  skills: SkillEntry[]
}

export interface SkillsPluginOptions {
  dir?: string
}

export interface ResolvedSkillsPluginOptions {
  dir: string
}
