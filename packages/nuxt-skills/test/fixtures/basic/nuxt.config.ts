import MyModule from '../../../src/module'

export default defineNuxtConfig({
  modules: [
    MyModule,
  ],
  vite: {
    server: {
      hmr: false,
    },
  },
})
