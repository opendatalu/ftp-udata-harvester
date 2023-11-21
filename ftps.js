import * as ftp from "basic-ftp"
import * as dotenv from 'dotenv'
import * as fs from 'fs'

console.log('ftps')

dotenv.config()

let ftps
async function connect() {
    ftps = new ftp.Client()
    ftps.ftp.verbose = false
    console.log( )
    try {
        return await ftps.access({
            host: process.env.ftpHost,
            port: process.env.ftpPort,
            user: process.env.ftpUser,
            password: process.env.ftpPass,
            secure: false
        })
    }
    catch(err) {
        console.log(err)
    }    
}

async function list(path) {
    return (await ftps.list(path)).filter(e => e.type == 1)
}

async function get(path) {
    const tmp = './tmpfile'
    await ftps.downloadTo(tmp, path)
    const content = fs.readFileSync(tmp)
    fs.unlinkSync(tmp)
    return content
}

function end() {
    return ftps.close()

}

export { connect, list, get, end }