import fetch from 'node-fetch'
import throttledQueue from 'throttled-queue'
import dotenv from 'dotenv'

dotenv.config()

// throttle API requests to avoid overloading the servers
const throttle = throttledQueue(parseInt(process.env.callRateNrCalls), parseInt(process.env.callRateDuration))
function fetchThrottle (...params) {
  return throttle(() => { return fetch(...params) })
}

let log = function () {}
if (process.env.debug === 'true') {
  log = console.log
}

function baseNames (files) {
  return files.map(e => { e.name = e.name.startsWith(process.env.ftpPath) ? e.name.slice(process.env.ftpPath.length + 1) : e.name; return e })
}

export { fetchThrottle, log, baseNames }
