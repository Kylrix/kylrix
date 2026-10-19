import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/extension.ts'],
  format: ['cjs'],
  target: 'node18',
  clean: true,
  dts: false,
  splitting: false,
  sourcemap: true,
  external: ['vscode'],
  noExternal: [/@kylrix\/.*/, /picocolors/],
  outExtension() {
    return {
      js: '.cjs',
    };
  },
});
