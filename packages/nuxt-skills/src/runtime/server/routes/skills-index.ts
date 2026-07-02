import { defineEventHandler, setResponseHeader } from 'h3'
import { useRuntimeConfig } from 'nitropack/runtime'
import { CACHE_CONTROL_VALUE } from 'unplugin-skills'

export default defineEventHandler((event) => {
  const { skills } = useRuntimeConfig(event)

  setResponseHeader(event, 'content-type', 'application/json; charset=utf-8')
  setResponseHeader(event, 'cache-control', CACHE_CONTROL_VALUE)

  return {
    skills: skills.catalog,
  }
})
