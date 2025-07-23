/**
 * Utility functions for FTP/SFTP udata harvester
 * Provides throttled HTTP requests, logging, and file path utilities
 */

import fetch from 'node-fetch'
import throttledQueue from 'throttled-queue'
import nodemailer from 'nodemailer'
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

/**
 * Send email notification about duplicate files
 * Uses nodemailer to send alerts when duplicates are detected
 *
 * @param {string} type - Type of duplicates (FTP or ODP)
 * @param {Array} duplicates - Array of duplicate file information
 */
async function sendDuplicateNotification (type, duplicates) {
  // Skip if email configuration is not provided
  if (!process.env.emailHost || !process.env.emailTo) {
    log('Email configuration missing, skipping duplicate notification')
    return
  }

  try {
    // Create transporter with email configuration
    const transporter = nodemailer.createTransporter({
      host: process.env.emailHost,
      port: parseInt(process.env.emailPort) || 587,
      secure: process.env.emailSecure === 'true',
      auth: {
        user: process.env.emailUser,
        pass: process.env.emailPass
      }
    })

    // Format duplicate information
    let duplicateList = ''
    duplicates.forEach(duplicate => {
      duplicateList += `\n• ${duplicate.filename}:\n`
      duplicate.files.forEach(file => {
        duplicateList += `  - ${file.name || file.url}\n`
      })
    })

    const hostname = new URL(process.env.odpURL).hostname
    // Compose email
    const mailOptions = {
      from: process.env.emailFrom || process.env.emailUser,
      to: process.env.emailTo,
      subject: 'FTP Harvester: Duplicates Detected',
      text: `Duplicate files have been detected during the FTP harvester synchronization.

Type: ${type}
Timestamp: ${new Date().toLocaleString()}

Duplicates found:${duplicateList}

Please review and resolve these duplicates to ensure proper synchronization.

This is an automated notification from ${hostname}.`
    }

    // Send email
    await transporter.sendMail(mailOptions)
    log(`Duplicate notification email sent successfully for ${type} duplicates`)
  } catch (error) {
    console.error('Failed to send duplicate notification email:', error.message)
  }
}

export { fetchThrottle, log, baseNames, sendDuplicateNotification }
