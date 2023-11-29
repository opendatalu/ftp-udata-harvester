import * as ftp from 'basic-ftp'
import * as dotenv from 'dotenv'
import * as fs from 'fs'

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

function baseNames (files) {
  return files.map(e => { e.name = e.name.startsWith(process.env.ftpPath) ? e.name.slice(process.env.ftpPath.length + 1) : e.name; return e })
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

async function get (path) {
  const tmp = './tmpfile'
  await ftps.downloadTo(tmp, path)
  const content = fs.readFileSync(tmp)
  fs.unlinkSync(tmp)
  return content
}

function end () {
  return ftps.close()
}

export { connect, list, get, end }
