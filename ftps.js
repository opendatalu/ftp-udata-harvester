/**
 * FTPS client module
 * Handles FTPS (FTP over TLS/SSL) connections and file operations for secure file transfer
 * Uses the basic-ftp library for FTP operations with explicit TLS encryption
 */

import * as ftp from 'basic-ftp'
import * as dotenv from 'dotenv'
import { baseNames } from './utils.js'
import { PassThrough } from 'stream'

dotenv.config()

// FTPS client instance (initialized on connect)
let ftps

/**
 * Establish FTPS connection using environment configuration
 * Connects with explicit TLS encryption for secure file transfer
 *
 * @returns {Promise} Connection promise
 */
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

/**
 * Normalize modification time property for consistency
 * The basic-ftp library uses 'modifiedAt' while other modules expect 'modifyTime'
 *
 * @param {Array} files - Array of file objects
 * @returns {Array} Files with normalized modifyTime property
 */
function addModifyTime (files) {
  return files.map(e => {
    e.modifyTime = e.modifiedAt
    return e
  })
}

/**
 * List files in a directory with optional recursive traversal
 *
 * @param {string} dir - Directory path to list
 * @returns {Promise<Array>} Array of file objects with relative paths and normalized timestamps
 */
async function list (dir) {
  const dirents = await ftps.list(dir)
  let result = []

  if (process.env.recursive === 'true') {
    const files = []

    // Sequential execution required - FTP library doesn't support concurrent operations
    for (const dirent of dirents) {
      // Build full path for the directory entry
      dirent.name = dir + '/' + dirent.name

      // Recursively process directories (type 2), include files (type 1) directly
      const result = (dirent.type === 2) ? await list(dirent.name) : dirent
      files.push(result)
    }

    // Flatten nested arrays from recursive calls
    result = Array.prototype.concat(...files)
  } else {
    // Non-recursive: only return regular files (type 1)
    result = dirents.filter(e => { return e.type === 1 })
  }

  // Normalize timestamps and convert to relative paths
  return addModifyTime(baseNames(result))
}

/**
 * Convert a readable stream to a Buffer
 * Collects all chunks from a stream and concatenates them into a single Buffer
 * Inspired by StackOverflow solution for stream-to-buffer conversion
 *
 * @see https://stackoverflow.com/questions/10623798/how-do-i-read-the-contents-of-a-node-js-stream-into-a-string-variable/63361543#63361543
 * @param {ReadableStream} stream - The stream to convert
 * @returns {Promise<Buffer>} Promise resolving to the complete buffer
 */
function streamToBuffer (stream) {
  const chunks = []
  return new Promise((resolve, reject) => {
    stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)))
    stream.on('error', (err) => reject(err))
    stream.on('end', () => resolve(Buffer.concat(chunks)))
  })
}

/**
 * Download a file from the FTPS server
 * Uses a PassThrough stream to capture file content as it downloads
 *
 * @param {string} path - Remote file path
 * @returns {Promise<Buffer>} File content as buffer
 */
async function get (path) {
  // Create a PassThrough stream to capture the download
  const tmp = new PassThrough()

  // Start both the buffer collection and download concurrently
  const content = streamToBuffer(tmp)
  const download = ftps.downloadTo(tmp, path)

  // Wait for both operations to complete
  await Promise.all([content, download])
  return content
}

/**
 * Close the FTPS connection
 *
 * @returns {Promise} Disconnection promise
 */
function end () {
  return ftps.close()
}

export { connect, list, get, end }
