/**
 * FTP/SFTP to udata harvester - Main synchronization logic
 * Synchronizes files from FTP servers to udata instances
 */

import * as dotenv from 'dotenv'
import process from 'node:process'
import * as odp from './odp.js'
import Path from 'path'
import { readFileSync } from 'fs'
import { log, sendDuplicateNotification } from './utils.js'

// Initialize crypto module for file hash validation
let crypto
try {
  crypto = await import('node:crypto')
} catch (err) {
  console.error('Error: crypto support is disabled!')
  process.exit(1)
}

// Dynamically load the appropriate FTP client based on protocol
let ftp
if (process.env.ftpProtocol === 'sftp') {
  ftp = await import('./sftp.js')
} else if (process.env.ftpProtocol === 'ftps') {
  ftp = await import('./ftps.js')
} else {
  // Default to local filesystem operations
  ftp = await import('./local.js')
}

/**
 * Convert file names to udata-compatible format
 * Normalizes file names following udata's slugification rules
 * Inspired by the python package awesome-slugify used in udata
 * @see https://github.com/voronind/awesome-slugify/blob/master/slugify/main.py
 *
 * @param {string} name - Original file name
 * @returns {string} Normalized file name compatible with udata
 */
function toODPNames (name) {
  name = Path.basename(name)

  // Remove accents using Unicode normalization
  name = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  // Convert to lowercase for consistency
  name = name.toLowerCase()
  // Remove apostrophes and trim whitespace
  name = name.replaceAll('\'', '').trim()

  // Split by unwanted characters (keep only alphanumeric and dots)
  const unwanted = /[^[A-Za-z0-9.]+/
  const words = name.split(unwanted)
  // Note: empty words are automatically filtered by join

  // Merge words with dashes as separators
  name = words.join('-')

  return name
}

/**
 * Extract filename from a URL path
 * @param {string} url - Full URL
 * @returns {string} Base filename from the URL path
 */
function getFilenameFromURL (url) {
  const pathName = new URL(url).pathname
  return Path.basename(pathName)
}

/**
 * Find resource metadata by filename
 * Searches through dataset resources to find metadata for a specific file
 *
 * @param {string} filename - Name of the file to find
 * @param {Array} resources - Array of resource objects from dataset
 * @returns {Object} Resource metadata object
 * @throws {Error} If file not found or multiple matches found
 */
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

/**
 * Remove duplicate files from FTP file list
 * Duplicates can occur when the same filename exists in different folders
 * This prevents sync issues - duplicates must be resolved at the source
 *
 * @param {Array} files - Array of file objects with .name property
 * @returns {Array} Array of unique files (duplicates removed entirely)
 */
async function removeDuplicatesOnFTP (files) {
  // Group files by basename to detect duplicates
  const test = {}
  files.forEach(e => {
    const fileName = Path.basename(e.name)
    if (test[fileName] === undefined) {
      test[fileName] = [e]
    } else {
      test[fileName].push(e)
    }
  })
  // Identify and remove all files that have duplicates
  const duplicateKeys = []
  const duplicatesForEmail = []
  Object.keys(test).forEach(k => {
    if (test[k].length > 1) {
      console.error('Error: Duplicates found on FTP for', k)
      console.error(test[k])
      process.exitCode = 1
      duplicateKeys.push(k)
      duplicatesForEmail.push({
        filename: k,
        files: test[k]
      })
    }
    // Keep only the first occurrence for unique files
    test[k] = test[k][0]
  })

  // Send email notification if duplicates found
  if (duplicatesForEmail.length > 0) {
    await sendDuplicateNotification('On the FTP', duplicatesForEmail)
  }

  // Remove all duplicate entries entirely
  duplicateKeys.forEach(k => {
    delete test[k]
  })
  return Object.values(test)
}

/**
 * Remove duplicate resources from Open Data Portal dataset
 * Duplicates can occur due to upload issues or manual uploads
 * Strategy: Keep the most recently modified version, delete others
 *
 * @param {string} dest - Dataset ID
 */
async function removeDuplicatesOnODP (dest) {
  const dataset = await odp.getDataset(dest)
  const resources = dataset.resources

  // Group resources by filename to detect duplicates
  const test = {}
  resources.forEach(e => {
    const fileName = getFilenameFromURL(e.url)
    if (test[fileName] === undefined) {
      test[fileName] = [e]
    } else {
      test[fileName].push(e)
    }
  })
  // Process duplicates: keep newest, mark others for deletion
  const duplicatesForEmail = []
  Object.keys(test).forEach(k => {
    if (test[k].length > 1) {
      console.error('Error: Duplicates found on ODP for', k)
      process.exitCode = 1
      duplicatesForEmail.push({
        filename: k,
        files: test[k]
      })
      // Sort by last_modified descending, keep the newest (first after sort)
      test[k] = test[k].sort((a, b) => { return b.last_modified - a.last_modified })
      // Remove the newest from deletion list (shift removes first element)
      test[k].shift()
    } else {
      // No duplicates, nothing to delete
      test[k] = []
    }
  })

  // Send email notification if duplicates found
  if (duplicatesForEmail.length > 0) {
    await sendDuplicateNotification('On the Open data portal', duplicatesForEmail)
  }
  // Flatten the arrays to get all resources marked for deletion
  const toDelete = Object.values(test).reduce((acc, cur) => acc.concat(cur), [])

  // Delete each duplicate resource
  for (const e of toDelete) {
    const result = await odp.deleteResource(dest, e.id)
    log('Resource deletion', (result) ? 'succeeded' : 'failed', 'for', e.url)
  }
}

/**
 * Detect filename collisions after ODP normalization
 * ODP normalizes filenames which can cause different source files to have the same target name
 * Returns both filtered file list and mapping for collision-free files
 *
 * @param {Array} files - Array of file objects
 * @returns {Array} [filteredFiles, mappingObject] - Files without collisions and filename mapping
 */
async function getMappingAndDetectCollisions (files) {
  // Create mapping from normalized ODP names to source files
  const mapping = {}
  files.forEach(e => {
    const fileName = toODPNames(Path.basename(e.name))
    if (mapping[fileName] === undefined) {
      mapping[fileName] = [e]
    } else {
      mapping[fileName].push(e)
    }
  })
  // Identify collisions and remove all affected files
  const duplicateKeys = []
  const collisionsForEmail = []
  Object.keys(mapping).forEach(k => {
    if (mapping[k].length > 1) {
      console.error('Error: name collision found for', k)
      process.exitCode = 1
      console.error(mapping[k].map(e => e.name))
      duplicateKeys.push(k)
      collisionsForEmail.push({
        filename: k,
        files: mapping[k]
      })
    }
    // For unique mappings, keep the single file
    mapping[k] = mapping[k][0]
  })

  // Send email notification if collisions found
  if (collisionsForEmail.length > 0) {
    await sendDuplicateNotification('Name Collision', collisionsForEmail)
  }

  // Remove collision entries from mapping
  duplicateKeys.forEach(k => {
    delete mapping[k]
  })

  // Filter out files that have name collisions
  files = files.filter(e => !duplicateKeys.includes(toODPNames(Path.basename(e.name))))
  return [files, mapping]
}

/**
 * Synchronize files from FTP source to ODP dataset
 * Main synchronization logic that handles file comparison and operations
 *
 * @param {string|Array} source - FTP path(s) to synchronize from
 * @param {string} dest - Dataset ID on ODP
 * @param {Object} ftp - FTP client module
 */
async function sync (source, dest, ftp) {
  // Handle both single source path and multiple source paths
  let dataset = await odp.getDataset(dest)
  let filesOnFTP = []

  if (typeof source === 'string') {
    log('--- Uploading all files in ', source, ' to dataset ', dataset.title)
    filesOnFTP = await ftp.list(source)
  } else if (Array.isArray(source)) {
    log('--- Uploading all files in ', source.join(';'), ' to dataset ', dataset.title)
    // Concatenate files from all source paths
    for (const s of source) {
      filesOnFTP = filesOnFTP.concat(await ftp.list(s))
    }
  } else {
    throw new Error('Error: Configuration issue, unknown source type')
  }

  // Demo mode: limit to first 10 files for testing
  if (process.env.demo === 'true') {
    filesOnFTP = filesOnFTP.slice(0, 10)
  }

  // Apply FTP-side regex filter if configured
  if (process.env.ftpRegex !== undefined) {
    filesOnFTP = filesOnFTP.filter(x => Path.basename(x.name).match(process.env.ftpRegex))
  }

  log('NR of files on FTP before cleanup:', filesOnFTP.length)

  // Clean up file list: remove duplicates and handle name collisions
  filesOnFTP = await removeDuplicatesOnFTP(filesOnFTP)
  const tmp = await getMappingAndDetectCollisions(filesOnFTP)
  filesOnFTP = tmp[0]  // Files without collisions
  const mapping = tmp[1]  // Normalized name -> file mapping

  // Create normalized filename collections for comparison
  const caseInsensitiveFilesOnFTPArr = filesOnFTP.map(e => toODPNames(e.name))
  const caseInsensitiveFilesOnFTPSet = new Set(caseInsensitiveFilesOnFTPArr)
  const nrFilesOnFTP = caseInsensitiveFilesOnFTPSet.size
  log('NR of files on FTP after cleanup:', nrFilesOnFTP)

  // Clean up duplicates on ODP side
  await removeDuplicatesOnODP(dest)

  // Get current files on ODP (only 'main' type resources)
  let filesOnODPArr = dataset.resources.filter(x => x.type == 'main').map(e => getFilenameFromURL(e.url))

  // Apply ODP-side regex filter if configured
  if (process.env.odpRegex !== undefined) {
    filesOnODPArr = filesOnODPArr.filter(x => x.match(process.env.odpRegex))
  }

  const filesOnODPSet = new Set(filesOnODPArr)

  // Calculate files to add (on FTP but not on ODP)
  let toAdd = [...new Set(caseInsensitiveFilesOnFTPArr.filter(x => !filesOnODPSet.has(x)))]

  // Sort files by modification date for consistent processing order
  toAdd = toAdd.sort((a, b) => { return mapping[a].modifyTime - mapping[b].modifyTime })

  // Calculate files to update (exists on both, only if overwrite enabled)
  let toUpdate = []
  if (process.env.overwrite === 'true') {
    toUpdate = [...new Set(caseInsensitiveFilesOnFTPArr.filter(x => filesOnODPSet.has(x)))]
  }

  // Calculate files to delete (on ODP but not on FTP)
  let toDelete = []
  toDelete = [...new Set(filesOnODPArr.filter(x => !caseInsensitiveFilesOnFTPSet.has(x)))]

  log('Files to add:', toAdd)
  log('Files to update:', toUpdate)
  log('Files to delete:', toDelete)

  // Process deletions first
  for (const e of toDelete) {
    const meta = getResourceMeta(e, dataset.resources)
    const result = await odp.deleteResource(dest, meta.id)

    if (result) {
      log('Resource deletion succeeded for', e)
    } else {
      console.error('Error: Resource deletion failed for', e)
      process.exitCode = 1
    }
  }
  // Process new file uploads
  for (const e of toAdd) {
    // Download file from FTP
    const file = await ftp.get(mapping[e].name)
    // Upload to ODP
    const result = await odp.uploadResource(e, file, dest, process.env.mimeType)

    const status = (Object.keys(result).length !== 0)
    if (status) {
      log('Resource upload succeeded for', e)
    } else {
      console.error('Error: Resource upload failed for', e)
      process.exitCode = 1
    }
  }
  // Process file updates with checksum validation
  for (const e of toUpdate) {
    // Download file from FTP
    const file = await ftp.get(mapping[e].name)
    // Get existing resource metadata
    const meta = getResourceMeta(e, dataset.resources)

    // Compare checksums to determine if update is needed
    const algo = meta.checksum.type
    const odpHash = meta.checksum.value

    let update = true

    // Calculate hash of FTP file
    const hash = crypto.createHash(algo)
    hash.update(file)
    const fileHash = hash.digest('hex')

    // Skip update if checksums match
    if (odpHash === fileHash) {
      update = false
      log('File ' + e + ' is already up to date.')
    }

    if (update) {
      // Update the file content
      const result = await odp.updateResource(e, file, dest, meta.id, process.env.mimeType)

      // Update metadata (workaround for potential udata bug)
      const resultMeta = await odp.updateResourceMeta(dest, meta.id, meta.title, meta.description)

      // Check if both operations succeeded
      const status = (Object.keys(result).length !== 0) && (Object.keys(resultMeta).length !== 0)
      if (status) {
        log('Resource update succeeded for', e)
      } else {
        console.error('Error: Resource update failed for', e)
        process.exitCode = 1
      }
    }
  }

  // Verification: ensure file counts match after synchronization
  dataset = await odp.getDataset(dest)
  let filesOnODP = dataset.resources.filter(x => x.type == 'main').map(e => getFilenameFromURL(e.url))

  // Apply same regex filter for accurate comparison
  if (process.env.odpRegex !== undefined) {
    filesOnODP = filesOnODP.filter(x => x.match(process.env.odpRegex))
  }

  // Final validation: file counts should match
  if (filesOnODP.length !== nrFilesOnFTP) {
    throw new Error(`Error: different number of files after sync, ODP: ${filesOnODP.length}, FTP: ${nrFilesOnFTP}`)
  }
}

/**
 * Main execution function
 * Handles configuration loading, FTP connection, and orchestrates sync operations
 */
async function main () {
  // Load environment configuration
  dotenv.config()

  log((new Date()).toLocaleString(), 'Syncing starts...')

  // Establish FTP connection
  await ftp.connect()
  log('Connection established')

  // Handle multiple dataset mappings or single dataset sync
  if (process.env.ftpMapping === 'true') {
    // Multi-dataset mode: read mapping from JSON file
    const mapping = JSON.parse(readFileSync('./mapping.json'))
    const dests = Object.keys(mapping)

    // Process each dataset mapping
    for (let i = 0; i < dests.length; i++) {
      const dest = dests[i]  // Dataset ID
      const source = mapping[dest]  // Source path(s)
      await sync(source, dest, ftp)
    }
  } else {
    // Single dataset mode: use environment variables
    await sync(process.env.ftpPath, process.env.odpDatasetId, ftp)
  }

  return ftp.end()
}

main().then(() => { log((new Date()).toLocaleString(), 'Sync successful') }).catch(e => { console.error(e); ftp.end(); process.exitCode = 1 })
