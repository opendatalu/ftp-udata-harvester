/**
 * SFTP client module
 * Handles SFTP connections and file operations for secure file transfer
 */

import Client from 'ssh2-sftp-client'
import * as dotenv from 'dotenv'
import { baseNames } from './utils.js'

dotenv.config()

// SFTP client instance (initialized on connect)
let sftp

/**
 * Establish SFTP connection using environment configuration
 * 
 * @returns {Promise} Connection promise
 */
async function connect () {
  sftp = new Client()
  return await sftp.connect({
    host: process.env.ftpHost,
    port: process.env.ftpPort,
    username: process.env.ftpUser,
    password: process.env.ftpPass
  })
}

/**
 * List files in a directory with optional recursive traversal
 * 
 * @param {string} dir - Directory path to list
 * @returns {Promise<Array>} Array of file objects with relative paths
 */
async function list (dir) {
  const dirents = await sftp.list(dir)
  let result = []
  
  if (process.env.recursive === 'true') {
    const files = []

    // Sequential execution required - SFTP library doesn't support concurrent operations
    for (const dirent of dirents) {
      // Build full path for the directory entry
      dirent.name = dir + '/' + dirent.name
      
      // Recursively process directories, include files directly
      const result = (dirent.type === 'd') ? await list(dirent.name) : dirent
      files.push(result)
    }

    // Flatten nested arrays from recursive calls
    result = Array.prototype.concat(...files)
  } else {
    // Non-recursive: only return regular files (type '-')
    result = dirents.filter(e => { return e.type === '-' })
  }
  
  // Convert absolute paths to relative paths
  return baseNames(result)
}

/**
 * Download a file from the SFTP server
 * 
 * @param {string} path - Remote file path
 * @returns {Promise<Buffer>} File content as buffer
 */
function get (path) {
  return sftp.get(path)
}

/**
 * Close the SFTP connection
 * 
 * @returns {Promise} Disconnection promise
 */
function end () {
  return sftp.end()
}

export { connect, list, get, end }
