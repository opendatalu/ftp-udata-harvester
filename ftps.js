import * as ftp from 'basic-ftp'
import * as dotenv from 'dotenv'
import { baseNames } from './utils.js'
import { PassThrough } from 'stream'

dotenv.config()

let ftps
async function connect () {
  ftps = new ftp.Client()
  ftps.ftp.verbose = false
  try {
    return await ftps.access({
      host: process.env.ftpHost,
      port: process.env.ftpPort,
      user: process.env.ftpUser,
      password: process.env.ftpPass,
      secure: false
    })
  } catch (err) {
    console.log(err)
  }
}

function addModifyTime (files) {
  return files.map(e => { e.modifyTime = e.modifiedAt; return e })
}

async function list (dir) {
  const dirents = await ftps.list(dir)
  let result = []
  if (process.env.recursive === 'true') {
    const files = []

    // cannot use Promise.all() here, the ftp library only accepts a sequential execution of the promises
    for (const dirent of dirents) {
      dirent.name = dir + '/' + dirent.name
      const result = (dirent.type === 2) ? await list(dirent.name) : dirent
      files.push(result)
    }

    result = Array.prototype.concat(...files)
  } else {
    result = dirents.filter(e => { return e.type === 1 })
  }
  return addModifyTime(baseNames(result))
}

// inspired from StackOverflow...
// https://stackoverflow.com/questions/10623798/how-do-i-read-the-contents-of-a-node-js-stream-into-a-string-variable/63361543#63361543
function streamToBuffer (stream) {
  const chunks = []
  return new Promise((resolve, reject) => {
    stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)))
    stream.on('error', (err) => reject(err))
    stream.on('end', () => resolve(Buffer.concat(chunks)))
  })
}

async function get (path) {
  const tmp = new PassThrough()
  const content = streamToBuffer(tmp)
  const download = ftps.downloadTo(tmp, path)

  await Promise.all([content, download])
  return content
}

function end () {
  return ftps.close()
}

export { connect, list, get, end }
