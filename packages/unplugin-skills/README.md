# unplugin-skills

[![npm version][npm-version-src]][npm-version-href]
[![npm downloads][npm-downloads-src]][npm-downloads-href]
[![License][license-src]][license-href]
[![pkg.pr.new](https://pkg.pr.new/badge/Barbapapazes/unplugin-skills)](https://pkg.pr.new/~/Barbapapazes/unplugin-skills)

Vite plugin for exposing local skills as `.well-known` files.

- 🔎 Scans a local `skills/` directory
- ⚡ Serves the skills index and files in dev
- 📦 Emits the same files during `vite build`

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

`SKILL.md` requires a `description` in YAML frontmatter. The skill name defaults to the directory name and must match it.

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
