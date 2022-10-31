import Client from 'ssh2-sftp-client'
import * as dotenv from 'dotenv'
import {  getDataset, uploadResource } from './odp.js'


async function main() {
  dotenv.config()

  const sftp = new Client();

  await sftp.connect({
    host: process.env.sftpHost,
    port: process.env.sftpPort,
    username: process.env.sftpUser, 
    password: process.env.sftpPass
  })
  const filesOnSFTP = (await sftp.list(process.env.sftpPath)).map(e => e.name.toLowerCase())
  const dataset = await getDataset(process.env.odpDatasetId)
  const filesOnODP = new Set(dataset.resources.map(e => e.title))
  let toAdd = [... new Set(filesOnSFTP.filter(x => !filesOnODP.has(x)))]
  if (process.env.sftpRegex !== undefined) {
    toAdd = toAdd.filter(x => x.match(process.env.sftpRegex))
  }
  console.log('Files do be uploaded:', toAdd)
  for (const e of toAdd) {
    // get file
    const file = await sftp.get(process.env.sftpPath+'/'+e)
    // upload file
    const result = await uploadResource(e, file, process.env.odpDatasetId, process.env.mimeType)

    // display status
    const status = (Object.keys(result).length !== 0)
    console.log('Resource upload', (result)?'succeeded': 'failed', 'for', e)
  }
  return sftp.end()
}


main().then(() => {console.log((new Date()).toLocaleString(), 'Sync successful')}).catch(e => {console.error(e)})
