import { createError, defineEventHandler, getMethod, getRequestURL, send, setResponseHeader } from 'h3'
import { useStorage } from 'nitropack/runtime'
import { CACHE_CONTROL_VALUE, getContentType, SKILLS_ROUTE_PREFIX } from 'unplugin-skills'

const SKILL_NAME = '[a-z0-9](?:[a-z0-9-]*[a-z0-9])?'
const ARTIFACT_PATH_REGEX = new RegExp(`^(?:${SKILL_NAME}/SKILL\\.md|${SKILL_NAME}\\.tar\\.gz)$`)

export default defineEventHandler(async (event) => {
  const method = getMethod(event)
  if (method !== 'GET' && method !== 'HEAD') {
    setResponseHeader(event, 'allow', 'GET, HEAD')
    throw createError({ statusCode: 405, statusMessage: 'Method Not Allowed' })
  }

  const rawPath = getRequestURL(event).pathname.slice(`${SKILLS_ROUTE_PREFIX}/`.length)
  let artifactPath: string
  try {
    artifactPath = decodeURIComponent(rawPath)
  }
  catch {
    throw createError({ statusCode: 400, statusMessage: 'Bad Request' })
  }

  if (artifactPath.split('/').some(segment => segment === '.' || segment === '..') || artifactPath.includes('\\'))
    throw createError({ statusCode: 400, statusMessage: 'Bad Request' })

  if (!ARTIFACT_PATH_REGEX.test(artifactPath))
    throw createError({ statusCode: 404, statusMessage: 'Not Found' })

  const content = await useStorage('assets:agent-skills').getItemRaw<Uint8Array>(artifactPath)
  if (content === null)
    throw createError({ statusCode: 404, statusMessage: 'Not Found' })

  setResponseHeader(event, 'content-type', getContentType(artifactPath))
  setResponseHeader(event, 'cache-control', CACHE_CONTROL_VALUE)
  setResponseHeader(event, 'content-length', content.byteLength)
  setResponseHeader(event, 'access-control-allow-origin', '*')

  return send(event, method === 'HEAD' ? undefined : content)
})
