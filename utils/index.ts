import {
  statSync,
  existsSync,
  copySync,
  copy,
  readFile,
} from 'fs-extra'
import * as glob from 'glob'
import {
  join,
  resolve,
} from 'path'
import p from 'fourdollar.promisify'


export async function copyAssets(src: string, dest: string, ...exceptions: string[]) {
  let files: string[] = glob.sync(src, {nodir: true, dot: true})
  exceptions.forEach(except => {
    const cs: string[] = glob.sync(except, {nodir: true, dot: true})
    files = files.filter(f => cs.indexOf(f) === -1)
  })
  files.forEach(s => {
    const d = join(dest, s.replace(/^[^\/]+/, ''))
    if(!(existsSync(d) && statSync(d).mtimeMs === statSync(s).mtimeMs)) {
      copySync(s, d)
      console.log(`copied: ${s} > ${d}`)
    }
  })
}

const releaseDir = '../../www/release'
export async function release() {
  const packFile = await readFile('package.json')
  const pack = JSON.parse(packFile.toString())
  await copy('archive.tar.gz', join(releaseDir, pack.name))
}
