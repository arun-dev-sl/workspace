import path from 'node:path'

import swc from 'unplugin-swc'
import tsconfigPaths from 'vite-tsconfig-paths'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@workspace/database': path.resolve(__dirname, '../../packages/database/src/index.ts'),
      '@workspace/domain': path.resolve(__dirname, '../../packages/domain/src/index.ts'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    root: './',
    include: ['src/**/*.spec.ts'],
    server: {
      deps: {
        inline: [/@workspace\/.*/],
      },
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      reportsDirectory: './coverage',
      include: ['src/**/*.ts'],
      exclude: [
        '**/*.spec.ts',
        '**/*.e2e-spec.ts',
        '**/index.ts',
        '**/*.module.ts',
      ],
      thresholds: {
        lines: 40,
        branches: 40,
        functions: 40,
        statements: 40,
      },
    },
  },
  plugins: [
    swc.vite({
      jsc: {
        parser: {
          syntax: 'typescript',
          decorators: true,
          dynamicImport: true,
        },
        transform: {
          legacyDecorator: true,
          decoratorMetadata: true,
        },
        target: 'esnext',
        keepClassNames: true,
      },
      module: {
        type: 'es6',
      },
    }),
    tsconfigPaths(),
  ],
})
