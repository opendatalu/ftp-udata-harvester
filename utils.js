import fetch from 'node-fetch'
import throttledQueue from 'throttled-queue'
import dotenv from 'dotenv'

dotenv.config()

// throttle API requests to avoid overloading the servers
const throttle = throttledQueue(parseInt(process.env.callRateNrCalls), parseInt(process.env.callRateDuration))
function fetchThrottle(...params) {
    return throttle(() => {return fetch(...params)})
} 

export { fetchThrottle }