import { defineConfig } from 'tsdown';
import packageJson from './package.json' with { type: 'json' };

export default defineConfig({
  entry: Object.values(packageJson.exports),
  dts: true,
  fixedExtension: false,
});
