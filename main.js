import * as dotenv from 'dotenv'
import process from 'node:process';
import {  getDataset, uploadResource } from './odp.js'

let ftp
if (process.env.ftpProtocol == "sftp") {
  ftp = await import('./sftp.js')
} else {
  ftp = await import('./ftps.js')
}

// get the udata string for a given input file name
function toODPNames(name) {
  return name.toLowerCase().replaceAll('_', '-')
}


async function main() {
  dotenv.config()

  console.log((new Date()).toLocaleString(), 'Syncing starts...')

  await ftp.connect()
  
  console.log('Connection established')

  // udata is transforming all file names to its own format
  const fileNamesOnSFTP = await ftp.list(process.env.ftpPath)

  console.log(fileNamesOnSFTP)
  const caseInsensitiveFilesOnSFTP = (fileNamesOnSFTP).map(e => toODPNames(e.name))
  const mapping = {}
  fileNamesOnSFTP.forEach(e => {
    mapping[toODPNames(e.name)] = e
  });

  const dataset = await getDataset(process.env.odpDatasetId)
  const filesOnODP = new Set(dataset.resources.map(e => e.title))

  let toAdd = [... new Set(caseInsensitiveFilesOnSFTP.filter(x => !filesOnODP.has(x)))]

  if (process.env.ftpRegex !== undefined) {
    toAdd = toAdd.filter(x => x.match(process.env.ftpRegex))
  }
  // sort files by modification date
  toAdd = toAdd.sort((a,b) => { return mapping[a].modifyTime - mapping[b].modifyTime })
  console.log("Files to be uploaded:", toAdd)
  for (const e of toAdd) {
    // get file
    const file = await ftp.get(process.env.ftpPath+'/'+mapping[e].name)
    // upload file
    const result = await uploadResource(e, file, process.env.odpDatasetId, process.env.mimeType)

    // display status
    const status = (Object.keys(result).length !== 0)
    console.log('Resource upload', (result)?'succeeded': 'failed', 'for', e)
  }
  return ftp.end()
}


main().then(() => {console.log((new Date()).toLocaleString(), 'Sync successful')}).catch(e => {console.error(e); process.exitCode = 1;})
