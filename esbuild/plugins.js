const fs = require('node:fs')
const path = require('node:path')

const hasGlob = pattern => /[*?[\]{}]/.test(pattern)

// Everything before the first path segment containing a glob character
const globBase = pattern => {
  const segments = pattern.split(path.sep)
  const firstGlobIndex = segments.findIndex(hasGlob)
  return segments.slice(0, firstGlobIndex).join(path.sep)
}

const copyFile = (from, to) => {
  fs.mkdirSync(path.dirname(to), { recursive: true })
  fs.copyFileSync(from, to)
}

/**
 * Copy files into the build output. `from` may be a single file or a glob; for globs the directory
 * structure below the non-glob prefix is preserved under `to`. If `from` is a single file and `to`
 * has a file extension, `to` is treated as the destination file, otherwise as a directory.
 * Missing sources are skipped, matching the behaviour of the previous esbuild-plugin-copy.
 * @param {{ from: string, to: string }[]} assets
 */
const copyAssets = (assets = []) =>
  assets.forEach(({ from, to }) => {
    if (hasGlob(from)) {
      const base = globBase(from)
      fs.globSync(from)
        .filter(file => fs.statSync(file).isFile())
        .forEach(file => copyFile(file, path.join(to, path.relative(base, file))))
    } else if (fs.existsSync(from)) {
      copyFile(from, path.extname(to) ? to : path.join(to, path.basename(from)))
    }
  })

/** @param {{ from: string, to: string }[]} assets */
const copyPlugin = assets => ({
  name: 'copy',
  setup(build) {
    build.onEnd(() => copyAssets(assets))
  },
})

/** @param {string[]} paths */
const cleanPlugin = (paths = []) => ({
  name: 'clean',
  setup(build) {
    build.onStart(() => paths.forEach(p => fs.rmSync(p, { recursive: true, force: true })))
  },
})

module.exports = { copyAssets, copyPlugin, cleanPlugin }
