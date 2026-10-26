const express = require('express');
const os = require('os');
const path = require('path');
const fs = require('fs');
const app = express();
const config = require('./config'); // Import the configuration

// Find the network IP address
const networkInterfaces = os.networkInterfaces();

for (const key of Object.keys(networkInterfaces)) {
    const networkInterface = networkInterfaces[key];
    for (const iface of networkInterface) {
        if (iface.family === 'IPv4' && !iface.internal) {
            config.server.host = iface.address;
            break;
        }
    }
}

const rootDirectory = config.directory; // Use the root directory from config

app.use(express.static(rootDirectory));

app.get('/', (req, res) => {
    listFilesInDirectory(rootDirectory, req, res);
});

// To Access the Folders
app.get('/*', (req, res) => {
    const requestedPath = path.join(rootDirectory, req.params[0]);
    listFilesInDirectory(requestedPath, req, res);
});

function listFilesInDirectory(directoryPath, req, res) {
    fs.readdir(directoryPath, (err, files) => {
        if (err) {
            return res.status(500).send('Error reading directory contents.');
        }

        const fileRows = [];
        for (const file of files) {
            const fileLink = path.join(req.path, file);
            const fileFullPath = path.join(directoryPath, file);
            const stats = fs.statSync(fileFullPath);
            const fileSize = stats.isFile() ? formatBytes(stats.size) : 'N/A';

            let icon = '📁'; // Folder icon
            if (!stats.isDirectory()) {
                const fileExt = path.extname(file).toLowerCase();
                if (fileExt === '.jpg' || fileExt === '.jpeg' || fileExt === '.png' || fileExt === '.gif') {
                    icon = '🖼️'; // Image file icon
                }
            }

            fileRows.push(`
          <tr>
            <td>${icon}</td>
            <td><a href="${fileLink}">${file}</a></td>
            <td>${stats.isDirectory() ? '-' : fileSize}</td>
          </tr>
        `);
        }

        const parentDirectory = path.dirname(req.path);
        const parentLink = parentDirectory === '/' ? '/' : `${parentDirectory}`;

        res.send(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>FTP-Server</title>
            <style>
              body {
                font-family: Arial, sans-serif;
              }
              table {
                width: 100%;
                border-collapse: collapse;
              }
              th, td {
                border: 1px solid #ccc;
                padding: 10px;
                text-align: left;
              }
            </style>
          </head>
          <body>
            <h1>Files in ${directoryPath}</h1>
            ${directoryPath != config.directory ? `<p><a href="/">Home</a> <a href="${parentLink}">Back</a></p>` : ''}
            <table>
              <thead>
                <tr>
                  <th></th>
                  <th>File/Folder Name</th>
                  <th>File Size</th>
                </tr>
              </thead>
              <tbody>
                ${fileRows.join('')}
              </tbody>
            </table>
          </body>
        </html>
      `);
    });
}

function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

app.listen(config.server.port, config.server.host, () => {
    console.log(`Server is running at http://${config.server.host}:${config.server.port}`);
});
