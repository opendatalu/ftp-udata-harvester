/**
 * Local filesystem client module
 * Handles local file operations using Node.js filesystem APIs
 * Provides the same interface as FTP/SFTP modules for local file synchronization
 */

import { readdir, readFile, stat } from 'fs/promises'
import * as dotenv from 'dotenv'
import { baseNames } from './utils.js'

dotenv.config()

/**
 * Establish connection (no-op for local filesystem)
 * Provides consistent interface with FTP/SFTP modules
 *
 * @returns {Promise<null>} Always resolves to null for local operations
 */
async function connect () {
  return null
}

/**
 * List files and directories in a local path
 * Reads directory contents and file statistics concurrently
 *
 * @param {string} path - Local directory path to list
 * @returns {Promise<Array>} Array of file objects with type and modification time
 */
async function list (path) {
  // Read directory entries
  const dirents = await readdir(path)

  // Get file infos for all entries concurrently
  const stats = await Promise.all((dirents.map(e => {
    return stat(path + '/' + e)
  })))

  // Build result array with file metadata
  const result = []
  dirents.forEach((v, i) => {
    result.push({
      name: path + '/' + v,
      type: stats[i].isFile() ? 'f' : (stats[i].isDirectory() ? 'd' : 'o'),
      modifyTime: stats[i].mtime
    })
  })

  return result
}

/**
 * Read a file from the local filesystem
 *
 * @param {string} path - Local file path
 * @returns {Promise<Buffer>} File content as buffer
 */
function get (path) {
  return readFile(path)
}

/**
 * Close connection (no-op for local filesystem)
 * Provides consistent interface with FTP/SFTP modules
 *
 * @returns {null} Always returns null for local operations
 */
function end () {
  return null
}

export { connect, list, get, end }
