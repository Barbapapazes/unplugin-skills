# unplugin-skills

[![npm version][npm-version-src]][npm-version-href]
[![npm downloads][npm-downloads-src]][npm-downloads-href]
[![License][license-src]][license-href]
[![pkg.pr.new](https://pkg.pr.new/badge/Barbapapazes/unplugin-skills)](https://pkg.pr.new/~/Barbapapazes/unplugin-skills)

Vite plugin for publishing local skills through Agent Skills Discovery RFC 0.2.

- 🔎 Scans a local `skills/` directory
- ⚡ Serves `/.well-known/agent-skills/index.json` and skill artifacts in dev
- 📦 Emits the same byte-exact assets during `vite build`

## Installation

```bash
pnpm add -D unplugin-skills
```

## Usage

Prefer the framework-specific package exports.

```ts
import skills from 'unplugin-skills/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [skills()],
})
```

## Skill directory

```text
skills/
	fake-skill/
		SKILL.md
		prompt.txt
```

`SKILL.md` requires explicit string `name` and `description` fields in YAML frontmatter. The name must match the directory, use lowercase letters, numbers, and single hyphens, and contain at most 64 characters. Descriptions must contain 1–1024 non-whitespace characters.

Hidden entries and generated or dependency directories (`node_modules`, `dist`, `.git`, `.cache`, `.nuxt`, and `.output`) are excluded. A skill is rejected if an included entry is a symlink, unsupported filesystem type, or unsafe archive path.

## Discovery output

The index uses the `https://schemas.agentskills.io/discovery/0.2.0/schema.json` schema. A skill containing only `SKILL.md` is exposed unchanged at `/.well-known/agent-skills/{name}/SKILL.md` with type `skill-md`. A skill with supporting files is exposed at `/.well-known/agent-skills/{name}.tar.gz` with type `archive` and `application/gzip` content type.

Archives contain files at their original paths from the skill root, without a wrapping directory. Their ordering and metadata are deterministic. Each index `digest` is `sha256:` followed by the SHA-256 hash of the exact artifact bytes served in development and emitted during builds.

## Credits

Heavily inspired by the [Docus skills module](https://github.com/nuxt-content/docus/blob/main/layer/modules/skills/index.ts). Huge thanks to the Nuxt team.

## Sponsors

<p align="center">
  <a href="https://github.com/sponsors/barbapapazes">
    <img src="https://cdn.jsdelivr.net/gh/barbapapazes/static/sponsors.svg" alt="Sponsor Barbapapazes" />
  </a>
</p>

## License

[MIT](https://github.com/Barbapapazes/unplugin-skills/blob/main/LICENSE) License © 2026-PRESENT [Estéban Soubiran](https://github.com/barbapapazes)

<!-- Badges -->
[npm-version-src]: https://img.shields.io/npm/v/unplugin-skills/latest.svg?style=flat&colorA=000&colorB=171717
[npm-version-href]: https://npmjs.com/package/unplugin-skills

[npm-downloads-src]: https://img.shields.io/npm/dm/unplugin-skills.svg?style=flat&colorA=000&colorB=171717
[npm-downloads-href]: https://npmjs.com/package/unplugin-skills

[license-src]: https://img.shields.io/npm/l/unplugin-skills.svg?style=flat&colorA=000&colorB=171717
[license-href]: https://npmjs.com/package/unplugin-skills
