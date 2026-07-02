import { createError, defineEventHandler, getRequestURL, setResponseHeader } from 'h3'
import { useRuntimeConfig, useStorage } from 'nitropack/runtime'
import { CACHE_CONTROL_VALUE, FILES_ROUTE_PREFIX, getContentType } from 'unplugin-skills'

function isPathTraversal(filePath: string): boolean {
  return filePath.split('/').includes('..')
}

export default defineEventHandler(async (event) => {
  const { pathname } = getRequestURL(event)

  if (!pathname.startsWith(FILES_ROUTE_PREFIX)) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Not Found',
    })
  }

  let filePath = ''

  try {
    filePath = decodeURIComponent(pathname.slice(FILES_ROUTE_PREFIX.length))
  }
  catch {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
    })
  }

  if (!filePath || isPathTraversal(filePath)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
    })
  }

  const { skills } = useRuntimeConfig(event)
  const [skillName, ...rest] = filePath.split('/')
  const skill = skills.catalog.find(skill => skill.name === skillName)
  const skillFilePath = rest.join('/')

  if (!skill || !skillFilePath || !skill.files.includes(skillFilePath)) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Not Found',
    })
  }

  const storage = useStorage('assets:skills')
  const content = await storage.getItemRaw(filePath)

  if (content === null) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Not Found',
    })
  }

  setResponseHeader(event, 'content-type', getContentType(filePath))
  setResponseHeader(event, 'cache-control', CACHE_CONTROL_VALUE)

  return content
})
