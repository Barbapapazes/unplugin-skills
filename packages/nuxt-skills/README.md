# nuxt-skills

[![npm version][npm-version-src]][npm-version-href]
[![npm downloads][npm-downloads-src]][npm-downloads-href]
[![License][license-src]][license-href]
[![pkg.pr.new](https://pkg.pr.new/badge/Barbapapazes/unplugin-skills)](https://pkg.pr.new/~/Barbapapazes/unplugin-skills)

Nuxt module for exposing local skills as `.well-known` files.

- 🔎 Scans a local `skills/` directory
- ⚡ Serves the skills index and files in dev
- 📦 Emits the same files during Nuxt builds

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

Options use the same shape as `unplugin-skills`; the Nuxt module scans the skills directory, registers Nitro server assets, and exposes the `.well-known` routes through server handlers.

```ts
export default defineNuxtConfig({
  modules: ['nuxt-skills'],
  skills: {
    dir: 'skills',
  },
})
```

See [`unplugin-skills`](https://github.com/Barbapapazes/unplugin-skills/tree/main/packages/unplugin-skills#readme) for skill directory structure and validation rules.

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
