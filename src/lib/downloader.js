const fs = require("fs")

const request = require("request")
const pMap = require("p-map")
const cliProgress = require("cli-progress")

async function getFileSize(file)
{
    return new Promise((resolve, reject) => {
        request
            .head(file.url)
            .on("error", err => reject(err))
            .on("response", function(response) {
                resolve(parseInt(response.headers["content-length"]))
            })
    })
}

async function download(multibar, file)
{
    if (fs.existsSync(file.absolutePath))
        return Promise.reject("Already downloaded")

    if (!fs.existsSync(file.folder))
        fs.mkdirSync(file.folder, { recursive: true })

    const fileSize = await getFileSize(file)
    const bar = multibar.create(100, 0, { file: file.filename, size: `${parseFloat(fileSize / 1000000).toFixed(2)} MB` })
    const writeStream = fs.createWriteStream(file.absolutePath)

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