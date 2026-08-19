# nuxt-skills

[![npm version][npm-version-src]][npm-version-href]
[![npm downloads][npm-downloads-src]][npm-downloads-href]
[![License][license-src]][license-href]
[![pkg.pr.new](https://pkg.pr.new/badge/Barbapapazes/unplugin-skills)](https://pkg.pr.new/~/Barbapapazes/unplugin-skills)

Nuxt module for publishing local skills through Agent Skills Discovery RFC 0.2.

- 🔎 Scans a local `skills/` directory
- ⚡ Serves `/.well-known/agent-skills/index.json` and skill artifacts
- 📦 Packages byte-exact generated artifacts as Nitro server assets

## Installation

```bash
pnpm add -D nuxt-skills
```

## Usage

Add the module to your Nuxt config.

```ts
export default defineNuxtConfig({
  modules: ['nuxt-skills'],
})
```

## Options

Options use the same shape as `unplugin-skills`. The module generates the RFC 0.2 index and artifacts during setup, registers them as Nitro server assets, and prerenders discovery routes where Nitro can preserve the artifact representation.

```ts
export default defineNuxtConfig({
  modules: ['nuxt-skills'],
  skills: {
    dir: 'skills',
  },
})
```

See [`unplugin-skills`](https://github.com/Barbapapazes/unplugin-skills/tree/main/packages/unplugin-skills#readme) for explicit frontmatter requirements, exclusions, symlink policy, raw `SKILL.md` versus deterministic `.tar.gz` behavior, and digest semantics. The former `/.well-known/skills` endpoint and `files` index field are not supported.

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
[npm-version-src]: https://img.shields.io/npm/v/nuxt-skills/latest.svg?style=flat&colorA=000&colorB=171717
[npm-version-href]: https://npmjs.com/package/nuxt-skills

[npm-downloads-src]: https://img.shields.io/npm/dm/nuxt-skills.svg?style=flat&colorA=000&colorB=171717
[npm-downloads-href]: https://npmjs.com/package/nuxt-skills

[license-src]: https://img.shields.io/npm/l/nuxt-skills.svg?style=flat&colorA=000&colorB=171717
[license-href]: https://npmjs.com/package/nuxt-skills
