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
- ftpHost: host name of the ftp server
- ftpPort: port of the ftp server
- ftpUser: login
- ftpPass: password
- ftpPath: absolute path to the folder to be synced
- ftpRegex: Optional. Define a regex to filter the filenames you want to be synced.
- ftpProtocol: one of the supported protocols: sftp or ftps or local for local files
- ftpMapping: if true, the script will load from the file mapping.json multiple couples (ftpPath, idpDatasetId). They should be stored in mapping.json like the following `{"destination id 1": "source path 1", "destination id 2": ["source path 2", "source path 3"], ...}`. When this option is in use, the variables odpDatasetId and ftpPath are inactive.
- mimeType: MIME type of the files which are synced.
- recursive: should we synchronize all the files in all subfolders under ftpPath recursively?
- overwrite: should existing files on data.public.lu be updated?
- debug: should we display debug information?

## Proxy
If your network connection depends on a proxy, you must set the `https_proxy` environment variable.
Example: `export https_proxy="http://myproxy:8080"`

## Run

You can launch the synchronization with the command `npm run main`.
The script named `run-win.sh` launches the synchronization on Windows and creates a log file. Bash.exe is needed, it can be found in [git for Windows](https://git-scm.com/download/win).

## Possible issues
The synchronisation only works if there are no duplicates, which can appear if the recursive mode is activated.
The open data portal will rename files to avoid download issues. This can lead to name collisions.
In the case of duplicates or name collisions, the concerned files will not be synchronised.

## License
This software is (c) [Information and press service](https://sip.gouvernement.lu/en.html) of the luxembourgish government and licensed under the MIT license.
