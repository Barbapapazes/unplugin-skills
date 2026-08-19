# Unplugin Skills

Expose local skills in Vite and Nuxt projects using [Agent Skills Discovery RFC 0.2](https://github.com/cloudflare/agent-skills-discovery-rfc). Both packages publish `/.well-known/agent-skills/index.json` and deterministic, SHA-256-addressed artifacts.

Skills containing only `SKILL.md` are served as raw Markdown. Skills with supporting files are served as deterministic `.tar.gz` archives with their files at the archive root.

## Packages

- [unplugin-skills](./packages/unplugin-skills) - Automatically expose your skills as static assets in your Vite projects.
- [nuxt-skills](./packages/nuxt-skills) - Automatically expose your skills as static assets in your Nuxt projects.

## Sponsors

<p align="center">
  <a href="https://github.com/sponsors/barbapapazes">
    <img src='https://cdn.jsdelivr.net/gh/barbapapazes/static/sponsors.svg' alt="Sponsors"/>
  </a>
</p>

## License

[MIT](./LICENSE) License © 2026-PRESENT [Estéban Soubiran](https://github.com/barbapapazes)
