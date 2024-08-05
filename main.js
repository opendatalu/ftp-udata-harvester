import * as dotenv from 'dotenv'
import process from 'node:process'
import * as odp from './odp.js'
import Path from 'path'
import { readFileSync } from 'fs'
import { log } from './utils.js'

let crypto
try {
  crypto = await import('node:crypto')
} catch (err) {
  console.error('crypto support is disabled!')
}

let ftp
if (process.env.ftpProtocol === 'sftp') {
  ftp = await import('./sftp.js')
} else if (process.env.ftpProtocol === 'ftps') {
  ftp = await import('./ftps.js')
} else {
  ftp = await import('./local.js')
}

// get the udata string for a given input file name
function toODPNames (name) {
  return Path.basename(name).toLowerCase().replaceAll(' ', '-').replaceAll('_', '-').replace(/--+/g, '-').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

function getFilenameFromURL (url) {
  const pathName = new URL(url).pathname
  return pathName.substring(pathName.lastIndexOf('/') + 1)
}

function getResourceMeta (filename, resources) {
  const resource = resources.filter(e => { return getFilenameFromURL(e.url) === filename })
  if (resource.length === 0) {
    throw new Error('Metadata not found for the file: ' + filename)
  }
  if (resource.length !== 1) {
    throw new Error('Multiple metadata found for the file: ' + filename)
  }
  return resource[0]
}

async function sync (source, dest, ftp) {
  // udata is transforming all file names to its own format
  const fileNamesOnFTP = await ftp.list(source)

  const caseInsensitiveFilesOnFTP = fileNamesOnFTP.map(e => toODPNames(e.name))
  const mapping = {}
  fileNamesOnFTP.forEach(e => {
    mapping[toODPNames(e.name)] = e
  })

  const dataset = await odp.getDataset(dest)
  const filesOnODP = new Set(dataset.resources.map(e => e.title))

  let toAdd = [...new Set(caseInsensitiveFilesOnFTP.filter(x => !filesOnODP.has(x)))]

  if (process.env.ftpRegex !== undefined) {
    toAdd = toAdd.filter(x => x.match(process.env.ftpRegex))
  }
  // sort files by modification date
  toAdd = toAdd.sort((a, b) => { return mapping[a].modifyTime - mapping[b].modifyTime })

  let toUpdate = []
  if (process.env.overwrite === 'true') {
    toUpdate = [...new Set(caseInsensitiveFilesOnFTP.filter(x => filesOnODP.has(x)))]
  }

  log('Files to add:', toAdd)
  log('Files to update:', toUpdate)
  for (const e of toAdd) {
    // get file
    const file = await ftp.get(mapping[e].name)
    // upload file
    const result = await odp.uploadResource(e, file, dest, process.env.mimeType)

    // display status
    const status = (Object.keys(result).length !== 0)
    log('Resource upload', (status) ? 'succeeded' : 'failed', 'for', e)
  }
  for (const e of toUpdate) {
    // get file
    const file = await ftp.get(mapping[e].name)
    // get Meta
    const meta = getResourceMeta(e, dataset.resources)

    // check if the file needs to be updated
    const algo = meta.checksum.type
    const odpHash = meta.checksum.value

    let update = true

    try {
      const hash = crypto.createHash(algo)
      hash.update(file)
      const fileHash = hash.digest('hex')
      // console.log(odpHash, fileHash)
      if (odpHash === fileHash) {
        update = false
        log('File ' + e + ' is already up to date.')
      }
    } catch (err) {
      console.error(err)
    }

    if (update) {
      // upload file
      const result = await odp.updateResource(e, file, dest, meta.id, process.env.mimeType)

      // update meta (udata bug?)
      const resultMeta = await odp.updateResourceMeta(dest, meta.id, meta.title, meta.description)

      // display status
      const status = (Object.keys(result).length !== 0) && (Object.keys(resultMeta).length !== 0)
      log('Resource update', (status) ? 'succeeded' : 'failed', 'for', e)
    }
  }
}

async function main () {
  dotenv.config()

  log((new Date()).toLocaleString(), 'Syncing starts...')

  await ftp.connect()

  log('Connection established')

  if (process.env.ftpMapping === 'true') {
    const mapping = JSON.parse(readFileSync('./mapping.json'))
    const sources = Object.keys(mapping)
    for (let i = 0; i < sources.length; i++) {
      const source = sources[i]
      const dest = mapping[source]
      await sync(source, dest, ftp)
    }
  } else {
    await sync(process.env.ftpPath, process.env.odpDatasetId, ftp)
  }

  return ftp.end()
}

main().then(() => { log((new Date()).toLocaleString(), 'Sync successful') }).catch(e => { console.error(e); ftp.end(); process.exitCode = 1 })
