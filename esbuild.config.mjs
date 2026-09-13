import * as esbuild from 'esbuild';
const options = {
  entryPoints: ['src/main.ts'], bundle: true, external: ['obsidian'],
  format: 'cjs', target: 'es2020', platform: 'browser', outfile: 'main.js',
  sourcemap: false, minify: true, legalComments: 'eof',
  banner: { js: '/* Knowledge Atlas | MIT | Bundled dependencies retain their licenses. */' }
};
if (process.argv.includes('--watch')) {
  const context = await esbuild.context(options);
  await context.watch();
  console.log('Watching plugin source...');
} else await esbuild.build(options);
