import { createError, defineEventHandler, getMethod, send, setResponseHeader } from 'h3'
import { useStorage } from 'nitropack/runtime'
import { CACHE_CONTROL_VALUE } from 'unplugin-skills'

export default defineEventHandler(async (event) => {
  const method = getMethod(event)
  if (method !== 'GET' && method !== 'HEAD') {
    setResponseHeader(event, 'allow', 'GET, HEAD')
    throw createError({ statusCode: 405, statusMessage: 'Method Not Allowed' })
  }

  const content = await useStorage('assets:agent-skills').getItemRaw<Uint8Array>('index.json')
  if (content === null)
    throw createError({ statusCode: 404, statusMessage: 'Not Found' })

  setResponseHeader(event, 'content-type', 'application/json; charset=utf-8')
  setResponseHeader(event, 'cache-control', CACHE_CONTROL_VALUE)
  setResponseHeader(event, 'content-length', content.byteLength)
  setResponseHeader(event, 'access-control-allow-origin', '*')

  return send(event, method === 'HEAD' ? undefined : content)
})
