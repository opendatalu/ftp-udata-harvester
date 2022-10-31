# sftp-udata-harvester
an harvester for sftp servers.

This harvester will download files from a folder on an ftp server and upload them as the resources of a dataset on an udata instance.

## Configuration

Copy the `.env.example` file into a file named `.env`. Adjust the following variales to your needs:

- odpURL: URL of the udata instance
- odpAPIKey: API key needed to access the udata API
- odpDatasetId: ID of the dataset where the files will be uploaded
- callRateNrCalls: this setting and the following are related to rate limiting. This is the max number of calls per period. By default 1.
- callRateDuration: this setting defines the duration of the period for rate limiting in milliseconds. By default 1000ms.
- sftpHost: host name of the sftp server
- sftpPort: port of the sftp server
- sftpUser: login
- sftpPass: password
- sftpPath: absolute path to the folder to be synced
- sftpRegex: Optional. Define a regex to filter the filenames you want to be synced.
- mimeType: MIME type of the files which are synced.

## Run

You can launch the synchronization with the command `npm run main`. 
The script named `run-win.sh` launches the synchronization on Windows and creates a log file. Bash.exe is needed, it can be found in [git for Windows](https://git-scm.com/download/win). 

## License
This software is (c) [Information and press service](https://sip.gouvernement.lu/en.html) of the luxembourgish government and licensed under the MIT license.
