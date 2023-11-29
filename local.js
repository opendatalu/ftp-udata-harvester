import { readdir, readFile, stat } from 'fs/promises'
import * as dotenv from 'dotenv'
import { baseNames } from './utils.js'

dotenv.config()

async function connect () {
  return null
}

async function list (path) {
  const dirents = await readdir(path)
  const stats = await Promise.all((dirents.map(e => { return stat(path + '/' + e) })))
  const result = []
  dirents.forEach((v, i) => {
    result.push({ name: path + '/' + v, type: stats[i].isFile() ? 'f' : (stats[i].isDirectory() ? 'd' : 'o'), modifyTime: stats[i].mtime })
  })
  return baseNames(result)
}

function get (path) {
  return readFile(path)
}

function end () {
  return null
}

export { connect, list, get, end }
