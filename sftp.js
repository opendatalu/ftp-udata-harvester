import Client from 'ssh2-sftp-client'
import * as dotenv from 'dotenv'
import { baseNames } from './utils.js'

dotenv.config()
let sftp

async function connect () {
  sftp = new Client()
  return await sftp.connect({
    host: process.env.ftpHost,
    port: process.env.ftpPort,
    username: process.env.ftpUser,
    password: process.env.ftpPass
  })
}

async function list (dir) {
  const dirents = await sftp.list(dir)
  let result = []
  if (process.env.recursive === 'true') {
    const files = []

    // cannot use Promise.all() here, the ftp library only accepts a sequential execution of the promises
    for (const dirent of dirents) {
      dirent.name = dir + '/' + dirent.name
      const result = (dirent.type === 'd') ? await list(dirent.name) : dirent
      files.push(result)
    }

    result = Array.prototype.concat(...files)
  } else {
    result = dirents.filter(e => { return e.type === '-' })
  }
  return baseNames(result)
}

function get (path) {
  return sftp.get(path)
}

function end () {
  return sftp.end()
}

export { connect, list, get, end }
