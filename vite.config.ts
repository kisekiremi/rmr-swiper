import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import dts from 'vite-plugin-dts'
import { resolve } from 'path'

export default defineConfig({
  plugins: [
    vue(),
    dts({
      insertTypesEntry: true,
      outDir: 'dist',
      rollupTypes: true,
      cleanVueFileName: true
    })
  ],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'RmrSwiper',
      fileName: (format) => `rmr-swiper.${format}.js`,
      formats: ['es', 'umd']
    },

    rollupOptions: {
      external: ['vue', 'swiper'],
      output: {
        globals: {
          vue: 'Vue',
          swiper: 'Swiper'
        }
      }
    }
  }
})
