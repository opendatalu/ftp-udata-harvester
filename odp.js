import dotenv from 'dotenv'
import { fetchThrottle, log } from './utils.js'
import { FormData, File } from 'node-fetch'
import { HttpsProxyAgent } from 'https-proxy-agent'

dotenv.config()

const odpURL = process.env.odpURL
const odpAPIKey = process.env.odpAPIKey

let proxyAgent = null
if (process.env.https_proxy !== undefined) {
  proxyAgent = new HttpsProxyAgent(process.env.https_proxy)
  log('Proxy set to:' + process.env.https_proxy)
}

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

async function uploadResource (filename, data, dsId, mime) {
  try {
    // uuid, filename, size, file*
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

async function updateResource (filename, data, dsId, resourceId, mime) {
  try {
    // uuid, filename, size, file*
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

export { getDataset, uploadResource, updateResource, updateResourceMeta }
