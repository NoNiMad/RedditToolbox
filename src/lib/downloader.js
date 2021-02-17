const fs = require("fs")
const path = require("path")

const request = require("request")
const pMap = require("p-map")
const cliProgress = require("cli-progress")

async function getContentLength(url)
{
    return new Promise((resolve, reject) => {
        request
            .head(url)
            .on("error", err => reject(err))
            .on("response", function(response) {
                resolve(parseInt(response.headers["content-length"]))
            })
    })
}

async function download(multibar, file)
{
    const filename = path.basename(file.path)
    const folder = path.dirname(file.path)

    if (fs.existsSync(file.path))
        return Promise.reject("File already exists")

    if (!fs.existsSync(folder))
        fs.mkdirSync(folder, { recursive: true })

    const fileSize = await getContentLength(file.url)
    const bar = multibar.create(100, 0, { file: filename, size: `${parseFloat(fileSize / 1000000).toFixed(2)} MB` })
    const writeStream = fs.createWriteStream(file.path)

    return new Promise((resolve, reject) => {
        let progress = 0

        request(file.url)
            .on("error", err => reject(err))
            .on("data", data => {
                writeStream.write(data)
                progress += Buffer.byteLength(data)
                bar.update(Math.floor(progress / fileSize * 100))
            })
            .on('end', function() {
                writeStream.close()
                multibar.remove(bar)
                resolve()
            })
    })
}

// files is an array of:
// {
//     url,
//     path
// }
async function downloadFiles(files)
{
    const multibar = new cliProgress.MultiBar({
        format: '{bar} {percentage}% | {file} ({size})',
        clearOnComplete: true,
        hideCursor: true
    }, cliProgress.Presets.shades_grey)
    
    await pMap(files, file => download(multibar, file), { concurrency: 5 } )
    
    multibar.stop()
}

module.exports = downloadFiles