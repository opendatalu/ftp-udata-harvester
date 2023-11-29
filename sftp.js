import Client from 'ssh2-sftp-client'
import * as dotenv from 'dotenv'

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

function list (path) {
  return sftp.list(path)
}

function get (path) {
  return sftp.get(path)
}

function end () {
  return sftp.end()
}

export { connect, list, get, end }
