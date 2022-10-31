import Client from 'ssh2-sftp-client'
import * as dotenv from 'dotenv'
import {  getDataset, uploadResource } from './odp.js'


// get the udata string for a given input file name
function toODPNames(name) {
  return name.toLowerCase().replaceAll('_', '-')
}


async function main() {
  dotenv.config()

  const sftp = new Client();

  await sftp.connect({
    host: process.env.sftpHost,
    port: process.env.sftpPort,
    username: process.env.sftpUser, 
    password: process.env.sftpPass
  })

  // udata is transforming all file names to its own format
  const fileNamesOnSFTP = await sftp.list(process.env.sftpPath)
  const caseInsensitiveFilesOnSFTP = (fileNamesOnSFTP).map(e => toODPNames(e.name))
  const mapping = {}
  fileNamesOnSFTP.forEach(e => {
    mapping[toODPNames(e.name)] = e
  });

  const dataset = await getDataset(process.env.odpDatasetId)
  const filesOnODP = new Set(dataset.resources.map(e => e.title))

  let toAdd = [... new Set(caseInsensitiveFilesOnSFTP.filter(x => !filesOnODP.has(x)))]

  if (process.env.sftpRegex !== undefined) {
    toAdd = toAdd.filter(x => x.match(process.env.sftpRegex))
  }
  // sort files by modification date
  toAdd = toAdd.sort((a,b) => { return mapping[a].modifyTime - mapping[b].modifyTime })
  console.log("Files to be uploaded:", toAdd)
  for (const e of toAdd) {
    // get file
    const file = await sftp.get(process.env.sftpPath+'/'+mapping[e].name)
    // upload file
    const result = await uploadResource(e, file, process.env.odpDatasetId, process.env.mimeType)

    // display status
    const status = (Object.keys(result).length !== 0)
    console.log('Resource upload', (result)?'succeeded': 'failed', 'for', e)
  }
  return sftp.end()
}


main().then(() => {console.log((new Date()).toLocaleString(), 'Sync successful')}).catch(e => {console.error(e)})
