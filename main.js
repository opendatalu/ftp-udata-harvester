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
  console.error('Error: crypto support is disabled!')
  process.exit(1)
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
// inspired by the python package awesome-slugify, used in udata to normalize file names
// https://github.com/voronind/awesome-slugify/blob/master/slugify/main.py
function toODPNames (name) {
  name = Path.basename(name)

  // remove accents
  name = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  // to lowercase
  name = name.toLowerCase()
  // remove ' and trim()
  name = name.replaceAll('\'', '').trim()

  // split by unwanted chars
  const unwanted = /[^[A-Za-z0-9.]+/
  const words = name.split(unwanted)
  // remove empty words

  // merge with dashes
  name = words.join('-')

  return name
}

function getFilenameFromURL (url) {
  const pathName = new URL(url).pathname
  return Path.basename(pathName)
}

// get the metadata for a specific resource based on its filename
function getResourceMeta (filename, resources) {
  const resource = resources.filter(e => { return getFilenameFromURL(e.url) === filename })
  if (resource.length === 0) {
    throw new Error('Error: Metadata not found for the file: ' + filename)
  }
  if (resource.length !== 1) {
    throw new Error('Error: Multiple metadata found for the file: ' + filename)
  }
  return resource[0]
}

// there can be duplicates on FTP (ex: same file name in different folders)
// this can cause issues in the sync process, so we need to remove them
// none of the duplicate files will be synchronized, the problem needs to be solved upstream
function removeDuplicatesOnFTP (files) {
  const test = {}
  files.forEach(e => {
    const fileName = Path.basename(e.name)
    if (test[fileName] === undefined) {
      test[fileName] = [e]
    } else {
      test[fileName].push(e)
    }
  })
  const duplicateKeys = []
  Object.keys(test).forEach(k => {
    if (test[k].length > 1) {
      console.error('Error: Duplicates found on FTP for', k)
      console.error(test[k])
      process.exitCode = 1
      duplicateKeys.push(k)
    }
    test[k] = test[k][0]
  })
  duplicateKeys.forEach(k => {
    delete test[k]
  })
  return Object.values(test)
}

// there can be duplicates on ODP (ex: upload issues, manual upload)
// detect and remove them
// heuristics: we keep the latest one based on the last modified date. The sync process will check afterwards if this file should be updated.
async function removeDuplicatesOnODP (dest) {
  const dataset = await odp.getDataset(dest)
  const resources = dataset.resources
  const test = {}
  resources.forEach(e => {
    const fileName = getFilenameFromURL(e.url)
    if (test[fileName] === undefined) {
      test[fileName] = [e]
    } else {
      test[fileName].push(e)
    }
  })
  Object.keys(test).forEach(k => {
    if (test[k].length > 1) {
      console.error('Error: Duplicates found on ODP for', k)
      process.exitCode = 1
      test[k] = test[k].sort((a, b) => { return b.last_modified - a.last_modified })
      test[k].shift()
    } else {
      test[k] = []
    }
  })
  const toDelete = Object.values(test).reduce((acc, cur) => acc.concat(cur), [])
  for (const e of toDelete) {
    // delete resource
    const result = await odp.deleteResource(dest, e.id)

    // display status
    log('Resource deletion', (result) ? 'succeeded' : 'failed', 'for', e.url)
  }
}

// there can be collisions on filenames, because the ODP normalizes the file names
// detect these collisions and return a mapping filename on ODP => file without collisions
function getMappingAndDetectCollisions (files) {
  const mapping = {}
  files.forEach(e => {
    const fileName = toODPNames(Path.basename(e.name))
    if (mapping[fileName] === undefined) {
      mapping[fileName] = [e]
    } else {
      mapping[fileName].push(e)
    }
  })
  const duplicateKeys = []
  Object.keys(mapping).forEach(k => {
    if (mapping[k].length > 1) {
      console.error('Error: name collision found for', k)
      process.exitCode = 1
      console.error(mapping[k].map(e => e.name))
      duplicateKeys.push(k)
    }
    mapping[k] = mapping[k][0]
  })
  duplicateKeys.forEach(k => {
    delete mapping[k]
  })
  files = files.filter(e => !duplicateKeys.includes(toODPNames(Path.basename(e.name))))
  return [files, mapping]
}

async function sync (source, dest, ftp) {
  // manage the case where a destination in the config file can have multiple source paths in an array
  let dataset = await odp.getDataset(dest)
  let filesOnFTP = []
  if (typeof source === 'string') {
    log('--- Uploading all files in ', source, ' to dataset ', dataset.title)
    filesOnFTP = await ftp.list(source)
  } else if (Array.isArray(source)) {
    log('--- Uploading all files in ', source.join(';'), ' to dataset ', dataset.title)
    for (const s of source) {
      filesOnFTP = filesOnFTP.concat(await ftp.list(s))
    }
  } else {
    throw new Error('Error: Configuration issue, unknown source type')
  }

  if (process.env.demo === 'true') {
    filesOnFTP = filesOnFTP.slice(0, 10)
  }

  if (process.env.ftpRegex !== undefined) {
    filesOnFTP = filesOnFTP.filter(x => Path.basename(x.name).match(process.env.ftpRegex))
  }

  log('NR of files on FTP before cleanup:', filesOnFTP.length)
  // remove duplicates and manage name collisions
  filesOnFTP = removeDuplicatesOnFTP(filesOnFTP)
  const tmp = getMappingAndDetectCollisions(filesOnFTP)
  filesOnFTP = tmp[0]
  const mapping = tmp[1]

  const caseInsensitiveFilesOnFTPArr = filesOnFTP.map(e => toODPNames(e.name))
  const caseInsensitiveFilesOnFTPSet = new Set(caseInsensitiveFilesOnFTPArr)
  const nrFilesOnFTP = caseInsensitiveFilesOnFTPSet.size
  log('NR of files on FTP after cleanup:', nrFilesOnFTP)

  await removeDuplicatesOnODP(dest)

  // compute list of files to add, to update and to delete
  let filesOnODPArr = dataset.resources.filter(x => x.type == 'main').map(e => getFilenameFromURL(e.url))
  if (process.env.odpRegex !== undefined) {
    filesOnODPArr = filesOnODPArr.filter(x => x.match(process.env.odpRegex))
  }
  const filesOnODPSet = new Set(filesOnODPArr)

  let toAdd = [...new Set(caseInsensitiveFilesOnFTPArr.filter(x => !filesOnODPSet.has(x)))]

  // sort files by modification date
  toAdd = toAdd.sort((a, b) => { return mapping[a].modifyTime - mapping[b].modifyTime })

  let toUpdate = []
  if (process.env.overwrite === 'true') {
    toUpdate = [...new Set(caseInsensitiveFilesOnFTPArr.filter(x => filesOnODPSet.has(x)))]
  }

  let toDelete = []
  toDelete = [...new Set(filesOnODPArr.filter(x => !caseInsensitiveFilesOnFTPSet.has(x)))]

  log('Files to add:', toAdd)
  log('Files to update:', toUpdate)
  log('Files to delete:', toDelete)
  for (const e of toDelete) {
    // get Meta
    const meta = getResourceMeta(e, dataset.resources)

    // delete resource
    const result = await odp.deleteResource(dest, meta.id)

    // display status
    if (result) {
      log('Resource deletion succeeded for', e)
    } else {
      console.error('Error: Resource deletion failed for', e)
      process.exitCode = 1
    }
  }
  for (const e of toAdd) {
    // get file
    const file = await ftp.get(mapping[e].name)
    // upload file
    const result = await odp.uploadResource(e, file, dest, process.env.mimeType)

    // display status
    const status = (Object.keys(result).length !== 0)
    if (status) {
      log('Resource upload succeeded for', e)
    } else {
      console.error('Error: Resource upload failed for', e)
      process.exitCode = 1
    }
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

    const hash = crypto.createHash(algo)
    hash.update(file)
    const fileHash = hash.digest('hex')

    if (odpHash === fileHash) {
      update = false
      log('File ' + e + ' is already up to date.')
    }

    if (update) {
      // upload file
      const result = await odp.updateResource(e, file, dest, meta.id, process.env.mimeType)

      // update meta (udata bug?)
      const resultMeta = await odp.updateResourceMeta(dest, meta.id, meta.title, meta.description)

      // display status
      const status = (Object.keys(result).length !== 0) && (Object.keys(resultMeta).length !== 0)
      if (status) {
        log('Resource update succeeded for', e)
      } else {
        console.error('Error: Resource update failed for', e)
        process.exitCode = 1
      }
    }
  }

  // check if the NR of files on ODP is consistent with what is on FTP
  dataset = await odp.getDataset(dest)
  let filesOnODP = dataset.resources.filter(x => x.type == 'main').map(e => getFilenameFromURL(e.url))
  if (process.env.odpRegex !== undefined) {
    filesOnODP = filesOnODP.filter(x => x.match(process.env.odpRegex))
  }


  if (filesOnODP.length !== nrFilesOnFTP) {
    throw new Error(`Error: different number of files after sync, ODP: ${filesOnODP.length}, FTP: ${nrFilesOnFTP}`)
  }
}

async function main () {
  dotenv.config()

  log((new Date()).toLocaleString(), 'Syncing starts...')

  await ftp.connect()

  log('Connection established')

  if (process.env.ftpMapping === 'true') {
    const mapping = JSON.parse(readFileSync('./mapping.json'))
    const dests = Object.keys(mapping)
    for (let i = 0; i < dests.length; i++) {
      const dest = dests[i]
      const source = mapping[dest]
      await sync(source, dest, ftp)
    }
  } else {
    await sync(process.env.ftpPath, process.env.odpDatasetId, ftp)
  }

  return ftp.end()
}

main().then(() => { log((new Date()).toLocaleString(), 'Sync successful') }).catch(e => { console.error(e); ftp.end(); process.exitCode = 1 })
