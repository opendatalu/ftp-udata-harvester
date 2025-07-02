/**
 * Open Data Portal (ODP) API client
 * Handles all interactions with udata API
 * Provides functions for dataset operations, resource management, and file uploads
 */

import dotenv from 'dotenv'
import { fetchThrottle, log } from './utils.js'
import { FormData, File } from 'node-fetch'
import { HttpsProxyAgent } from 'https-proxy-agent'

dotenv.config()

// ODP API configuration from environment
const odpURL = process.env.odpURL
const odpAPIKey = process.env.odpAPIKey

// Initialize proxy agent if configured
let proxyAgent = null
if (process.env.https_proxy !== undefined) {
  proxyAgent = new HttpsProxyAgent(process.env.https_proxy)
  log('Proxy set to:' + process.env.https_proxy)
}

/**
 * Retrieve dataset information from ODP
 *
 * @param {string} id - Dataset ID
 * @returns {Promise<Object>} Dataset object with resources and metadata
 */
async function getDataset (id) {
  try {
    const params = {
      headers: {
        Accept: 'application/json, text/plain, */*',
        'Content-Type': 'application/json;charset=utf-8',
        'X-API-KEY': odpAPIKey
      },
      method: 'GET'
    }

    // Add proxy agent if configured
    if (proxyAgent !== null) {
      params.agent = proxyAgent
    }

    const res = await fetchThrottle(odpURL + '/datasets/' + id + '/', params)
    if (!res.ok) {
      res.text().then(t => { throw new Error(`status code: ${res.status}, response: ${t}`) })
    }

    return res.json()
  } catch (e) {
    console.error(e)
    return {}
  }
}

/**
 * Upload a new resource to a dataset
 *
 * @param {string} filename - Name for the uploaded file
 * @param {Buffer|Uint8Array} data - File content as binary data
 * @param {string} dsId - Dataset ID to upload to
 * @param {string} mime - MIME type of the file
 * @returns {Promise<Object>} Upload response or empty object on error
 */
async function uploadResource (filename, data, dsId, mime) {
  try {
    // Prepare multipart form data for file upload
    const formData = new FormData()
    const file = new File([data], filename, { type: mime })

    formData.set('filename', filename)
    formData.set('file', file, filename)

    const params = {
      headers: {
        Accept: 'application/json',
        'Cache-Control': 'no-cache',
        'X-API-KEY': odpAPIKey
      },
      body: formData,
      method: 'POST'
    }

    if (proxyAgent !== null) {
      params.agent = proxyAgent
    }

    const res = await fetchThrottle(odpURL + '/datasets/' + dsId + '/upload/', params)
    if (!res.ok) {
      res.text().then(t => { throw new Error(`status code: ${res.status}, response: ${t}`) })
    }
    return res.json()
  } catch (e) {
    console.error(e)
    return {}
  }
}

/**
 * Update an existing resource with new file content
 *
 * @param {string} filename - Name for the updated file
 * @param {Buffer|Uint8Array} data - New file content as binary data
 * @param {string} dsId - Dataset ID containing the resource
 * @param {string} resourceId - ID of the resource to update
 * @param {string} mime - MIME type of the file
 * @returns {Promise<Object>} Update response or empty object on error
 */
async function updateResource (filename, data, dsId, resourceId, mime) {
  try {
    // Prepare multipart form data for file update
    const formData = new FormData()
    const file = new File([data], filename, { type: mime })

    formData.set('filename', filename)
    formData.set('file', file, filename)

    const params = {
      headers: {
        Accept: 'application/json',
        'Cache-Control': 'no-cache',
        'X-API-KEY': odpAPIKey
      },
      body: formData,
      method: 'POST'
    }

    if (proxyAgent !== null) {
      params.agent = proxyAgent
    }

    const res = await fetchThrottle(`${odpURL}/datasets/${dsId}/resources/${resourceId}/upload/`, params)
    if (!res.ok) {
      res.text().then(t => { throw new Error(`status code: ${res.status}, response: ${t}`) })
    }
    return res.json()
  } catch (e) {
    console.error(e)
    return {}
  }
}

/**
 * Update resource metadata (title and description)
 *
 * @param {string} dsId - Dataset ID containing the resource
 * @param {string} resId - Resource ID to update
 * @param {string} title - New title for the resource
 * @param {string} desc - New description for the resource
 * @returns {Promise<Object>} Update response or empty object on error
 */
async function updateResourceMeta (dsId, resId, title, desc) {
  try {
    const body = { title, description: desc }

    const params = {
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'X-API-KEY': odpAPIKey
      },
      body: JSON.stringify(body),
      method: 'PUT'
    }

    if (proxyAgent !== null) {
      params.agent = proxyAgent
    }

    const res = await fetchThrottle(`${odpURL}/datasets/${dsId}/resources/${resId}/`, params)
    if (!res.ok) {
      res.text().then(t => { throw new Error(`status code: ${res.status}, response: ${t}`) })
    }
    return res.json()
  } catch (e) {
    console.error(e)
    return {}
  }
}

/**
 * Delete a resource from a dataset
 *
 * @param {string} dsId - Dataset ID containing the resource
 * @param {string} resId - Resource ID to delete
 * @returns {Promise<boolean>} True if deletion successful, false otherwise
 */
async function deleteResource (dsId, resId) {
  try {
    const params = {
      headers: {
        Accept: 'application/json, text/plain, */*',
        'Content-Type': 'application/json',
        'X-API-KEY': odpAPIKey
      },
      method: 'DELETE'
    }

    if (proxyAgent !== null) {
      params.agent = proxyAgent
    }

    const res = await fetchThrottle(`${odpURL}/datasets/${dsId}/resources/${resId}/`, params)
    // HTTP 204 indicates successful deletion with no content
    return res.status === 204
  } catch (e) {
    console.error(e)
    return false
  }
}

export { getDataset, uploadResource, updateResource, updateResourceMeta, deleteResource }
