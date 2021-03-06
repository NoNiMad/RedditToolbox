const fs = require("fs")
const path = require("path")
const request = require("request")
const utils = require("./utils")

function getLocalFileSize(file)
{
    let stats = fs.statSync(file.path)
    return stats["size"]
}

async function getFileSize(file)
{
    return new Promise((resolve, reject) => {
        if (!fs.existsSync(file.path))
        {
            reject(new Error(`"${file.path}" doesn't exist`))
        }
        else
        {
            request
                .head(file.url)
                .on("error", err => reject(err))
                .on("response", function(response) {
                    resolve(parseInt(response.headers["content-length"]))
                })
        }
    })
}

async function checkFiles(files)
{
    let fileSizes = await utils.allSettled(files.map(file => getFileSize(file)))
    return files.map((file, i) => {
        let fileSize = fileSizes[i]
        if (fileSize.status === "rejected")
        {
            return {
                success: false,
                error: fileSize.reason
            }
        }
        else
        {
            let localSize = getLocalFileSize(file)
            let expectedSize = fileSize.value
            if (localSize !== expectedSize)
            {
                return {
                    success: true,
                    needDownload: true
                }
            }
            
            return {
                success: true,
                needDownload: false
            }
        }
    })
}

module.exports = checkFiles