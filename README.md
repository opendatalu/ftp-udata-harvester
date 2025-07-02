# FTP/SFTP to udata Harvester

A file synchronization tool that harvests files from FTP, SFTP, or local filesystems and uploads them as resources to an udata-based open data portal.

## Overview

This harvester automatically synchronizes files between remote file servers and udata datasets, providing:
- **Multi-protocol support**: SFTP, FTPS, and local filesystem operations
- **Smart duplicate detection**: Handles duplicates on both source and destination
- **Filename normalization**: Manages udata's file naming requirements
- **Incremental updates**: Only updates files when content changes (checksum validation)
- **Rate limiting**: Configurable API throttling to respect server limits
- **Multi-dataset support**: Synchronize multiple sources to different datasets

## Quick Start

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Configure environment**:
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Run synchronization**:
   ```bash
   npm run main
   ```

## Configuration

Copy `.env.example` to `.env` and configure the following variables:

### Open Data Portal Settings
| Variable | Description |
|----------|-------------|
| `odpURL` | udata API endpoint |
| `odpAPIKey` | API authentication key |
| `odpDatasetId` | Target dataset ID |

### Connection Settings
| Variable | Description |
|----------|-------------|
| `ftpHost` | Server hostname or IP |
| `ftpPort` | Connection port |
| `ftpUser` | Username for authentication |
| `ftpPass` | Password for authentication |
| `ftpPath` | Absolute path to sync folder |
| `ftpProtocol` | Protocol: `sftp`, `ftps`, or `local` |

### File Processing
| Variable | Description |
|----------|-------------|
| `mimeType` | MIME type for uploaded files |
| `recursive` | Sync subdirectories recursively |
| `overwrite` | Update existing files |
| `ftpRegex` | Filter files on source (optional) |
| `odpRegex` | Filter files on destination (optional) |

### Rate Limiting
| Variable | Description |
|----------|-------------|
| `callRateNrCalls` | Max API calls per period (0=unlimited) |
| `callRateDuration` | Rate limit period (milliseconds) |

### Advanced Options
| Variable | Description |
|----------|-------------|
| `ftpMapping` | Enable multi-dataset mode |
| `debug` | Enable debug logging |
| `demo` | Limit to 10 files for testing |

### Multi-Dataset Configuration

For synchronizing multiple sources to different datasets, set `ftpMapping=true` and create a `mapping.json` file:

```json
{
  "dataset-id-1": "/path/to/source1",
  "dataset-id-2": ["/path/to/source2a", "/path/to/source2b"],
  "dataset-id-3": "/path/to/source3"
}
```

### Proxy Configuration

For networks requiring proxy access:
```bash
export https_proxy="http://proxy.example.com:8080"
# or
export https_proxy="http://username:password@proxy.example.com:8080"
```

## Usage

### Basic Synchronization
```bash
# Run once
npm run main

# Run with logging (Unix/Linux/macOS)
./run.sh

# Run with logging (Windows - requires Git Bash)
./run-win.sh
```

### Example Configurations

**SFTP Server Sync**:
```bash
ftpProtocol=sftp
ftpHost=files.example.com
ftpPort=22
ftpUser=datauser
ftpPass=secretpassword
ftpPath=/data/public
mimeType=text/csv
recursive=true
ftpRegex=".*\.csv$"
```

**Local Directory Sync**:
```bash
ftpProtocol=local
ftpPath=/home/user/documents/data
mimeType=application/pdf
recursive=false
```

**FTPS with Rate Limiting**:
```bash
ftpProtocol=ftps
ftpHost=secure.example.com
ftpPort=21
callRateNrCalls=2
callRateDuration=5000
```

## How It Works

### Synchronization Process

1. **Connection**: Establishes connection to the specified protocol (SFTP/FTPS/local)
2. **File Discovery**: Lists all files from source location(s)
3. **Filtering**: Applies regex filters if configured
4. **Duplicate Detection**: Removes duplicates on both source and destination
5. **Normalization**: Converts filenames to udata-compatible format
6. **Comparison**: Determines files to add, update, or delete
7. **Synchronization**: Performs file operations with checksum validation
8. **Verification**: Ensures file counts match after sync

### File Naming

The harvester automatically normalizes filenames for udata compatibility:
- Removes accents and converts to lowercase
- Replaces special characters with dashes
- Handles Unicode normalization

Example: `Données_été_2023.pdf` → `donnees-ete-2023.pdf`

## Troubleshooting

### Common Issues

**Duplicate Files**
- Issue: Same filename exists in different source directories
- Solution: Resolve duplicates at source or use specific directory paths
- Files with duplicates are excluded from sync for safety

**Name Collisions**
- Issue: Different source files normalize to same target name
- Solution: Rename source files to avoid conflicts
- Example: `file_1.txt` and `file-1.txt` both become `file-1.txt`

**File Type Restrictions**
- Only "main" type resources are synchronized
- Documentation files should be tagged as different resource types
- Non-main resources are preserved during sync

### Debug Mode

Enable detailed logging:
```bash
debug=true
npm run main
```

### Validation

The harvester performs several validation checks:
- File count consistency between source and destination
- Checksum verification for updates
- API response validation
- Duplicate detection on both sides

## Architecture

The harvester uses a modular architecture:

- **main.js**: Core synchronization logic
- **odp.js**: Open Data Portal API client
- **sftp.js**: SFTP protocol implementation
- **ftps.js**: FTPS protocol implementation
- **local.js**: Local filesystem operations
- **utils.js**: Shared utilities (throttling, logging, path handling)

## Requirements

- Node.js 16+ (ES modules support)
- Network access to target udata instance
- Valid API credentials for the open data portal
- Access to source files (FTP/SFTP credentials or local filesystem)

## License

This software is © [Information and Press Service](https://sip.gouvernement.lu/en.html) of the Luxembourg Government and licensed under the MIT license.
