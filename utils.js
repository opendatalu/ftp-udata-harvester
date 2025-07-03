/**
 * Utility functions for FTP/SFTP udata harvester
 * Provides throttled HTTP requests, logging, and file path utilities
 */

import fetch from 'node-fetch'
import throttledQueue from 'throttled-queue'
import dotenv from 'dotenv'

dotenv.config()

// Initialize throttling for API requests to avoid server overload
const throttle = throttledQueue(parseInt(process.env.callRateNrCalls), parseInt(process.env.callRateDuration))

/**
 * Throttled fetch wrapper for API requests
 * Uses rate limiting based on environment configuration to prevent server overload
 * 
 * @param {...any} params - Parameters to pass to fetch()
 * @returns {Promise} - Fetch promise (throttled or direct)
 */
function fetchThrottle (...params) {
  if (parseInt(process.env.callRateNrCalls) === 0) {
    // No throttling when callRateNrCalls is 0
    return fetch(...params)
  } else {
    // Apply throttling with configured rate limits
    return throttle(() => { return fetch(...params) })
  }
}

/**
 * Conditional logging function
 * Only logs when debug mode is enabled via environment variable
 */
let log = function () {}
if (process.env.debug === 'true') {
  log = console.log
}

/**
 * Convert absolute file paths to relative paths
 * Removes the FTP base path from file names to get relative paths
 * 
 * @param {Array} files - Array of file objects with .name property
 * @returns {Array} Files with relative path names
 */
function baseNames (files) {
  return files.map(e => {
    // Remove FTP base path prefix if present, including trailing slash
    e.name = e.name.startsWith(process.env.ftpPath) 
      ? e.name.slice(process.env.ftpPath.length + 1) 
      : e.name
    return e
  })
}

export { fetchThrottle, log, baseNames }
