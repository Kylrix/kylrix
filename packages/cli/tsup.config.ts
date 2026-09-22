import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'node18',
  clean: true,
  dts: true,
  splitting: false,
  sourcemap: false,
  banner: {
    js: '#!/usr/bin/env node',
  },
  outExtension: () => ({
    js: '.js',
    dts: '.d.ts',
  }),
  noExternal: [/@kylrix\/.*/, /@clack\/.*/],
});
