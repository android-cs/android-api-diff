import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/index.ts', 'src/code.ts', 'src/code-render.ts', 'src/query.ts'],
  dts: true,
  fixedExtension: false,
});
