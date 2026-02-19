import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    // 覆盖率仅统计 lib 层和 API 工具，不包含 UI 组件
    coverage: {
      include: ['src/lib/**', 'src/app/api/**'],
      exclude: ['src/app/api/**/route.ts'], // routes 依赖外部服务，用集成测试覆盖
      reporter: ['text', 'json-summary'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
