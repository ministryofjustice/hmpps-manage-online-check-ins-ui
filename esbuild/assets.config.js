/* eslint-disable no-console */

const autoprefixer = require('autoprefixer')
const postcss = require('postcss')
const postcssPresetEnv = require('postcss-preset-env')
const { sassPlugin } = require('esbuild-sass-plugin')
const esbuild = require('esbuild')
const path = require('path')
const { glob } = require('glob')
const { cleanPlugin, copyPlugin } = require('./plugins')

const buildAdditionalAssets = buildConfig =>
  esbuild.build({
    outdir: buildConfig.assets.outDir,
    plugins: [copyPlugin(buildConfig.assets.copy)],
  })

const buildAssets = buildConfig =>
  esbuild.build({
    entryPoints: buildConfig.assets.entryPoints,
    outdir: buildConfig.assets.outDir,
    entryNames: '[ext]/app',
    minify: buildConfig.isProduction,
    sourcemap: buildConfig.sourcemap,
    platform: 'browser',
    target: 'es2023',
    external: ['/assets/*'],
    bundle: true,
    plugins: [
      cleanPlugin(glob.sync(buildConfig.assets.clear)),
      sassPlugin({
        quietDeps: true,
        loadPaths: [process.cwd(), path.join(process.cwd(), 'node_modules')],
        async transform(source, resolveDir) {
          const { css } = await postcss([autoprefixer, postcssPresetEnv({ stage: 0 })]).process(source, {
            from: undefined,
          })
          return css
        },
      }),
    ],
  })

module.exports = buildConfig => {
  console.log('\u{1b}[1m\u{2728}  Building assets...\u{1b}[0m')

  return Promise.all([buildAssets(buildConfig), buildAdditionalAssets(buildConfig)])
}
