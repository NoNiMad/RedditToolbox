const url = require("url")
const path = require("path")
const request = require("request")
const mime = require("mime-types")

const videoExtensions = [ "mp4" ]
const extensionRenaming = {
    "jpeg": "jpg"
}

async function getMediaAtUrl(mediaUrl)
{
    return new Promise((resolve, reject) => {
        request
            .head(mediaUrl)
            .on("error", err => reject(err))
            .on("response", function(response) {
                const contentType = response.headers["content-type"]
                if (contentType !== undefined && (contentType.startsWith("image") || contentType.startsWith("video")))
                {
                    let extension = mime.extension(contentType)
                    if (extension === false)
                        resolve(null)

                    if (extensionRenaming[extension] !== undefined)
                        extension = extensionRenaming[extension]

                    resolve({
                        url: mediaUrl,
                        isVideo: videoExtensions.includes(extension),
                        extension: extension
                    })
                }
                else
                {
                    resolve(null)
                }
            })
    })
}

async function findMediasInSubmission(submission)
{
    if (submission.crosspost_parent_list !== undefined && submission.crosspost_parent_list.length > 0)
    {
        const crosspostMediaInfo = await findMediasInSubmission(submission.crosspost_parent_list[0])
        if (crosspostMediaInfo.length > 0)
            return crosspostMediaInfo
    }

    if (submission.media !== undefined && submission.media !== null)
    {
        if (submission.media.reddit_video !== undefined)
        {
            return [{
                url: submission.media.reddit_video.fallback_url.replace("?source=fallback", ""),
                isVideo: true,
                extension: "mp4"
            }]
        }
        else if (submission.media.type === "gfycat.com")
        {
            return [{
                url: submission.media.oembed.thumbnail_url.replace("size_restricted.gif", "mobile.mp4"),
                isVideo: true,
                extension: "mp4"
            }]
        }
    }

    if (submission.url !== undefined)
    {
        if (submission.url.startsWith("https://www.reddit.com/gallery/"))
        {
            return Object.values(submission.media_metadata)
                .filter(mediaMetadata => mediaMetadata.status == "valid")
                .map(mediaMetadata => {
                    let extension = mime.extension(mediaMetadata.m)
                    if (extension === false)
                        return null

                    if (extensionRenaming[extension] !== undefined)
                        extension = extensionRenaming[extension]

                    return {
                        url: mediaMetadata.s.u,
                        isVideo: videoExtensions.includes(extension),
                        extension: extension
                    }
                })
                .filter(mediaInfo => mediaInfo !== null)
        }

        let media = await getMediaAtUrl(submission.url)
        if (media !== null)
            return [media]
        
        if (submission.preview.images.length > 0)
        {
            let firstImageWithSource = submission.preview.images.find(image => image.source !== undefined)
            if (firstImageWithSource === undefined)
                return []
            
            return [await getMediaAtUrl(firstImageWithSource.source.url)]
        }
        return []
    }

    return []
}

module.exports = {
    findMediasInSubmission
}