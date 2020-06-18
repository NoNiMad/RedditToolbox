const url = require("url")
const path = require("path")
const request = require("request")

const videoExtensions = [ "mp4" ]

async function findMediaInSubmission(submission)
{
    if (submission.media !== undefined && submission.media !== null)
    {
        if (submission.media.reddit_video !== undefined)
        {
            return {
                url: submission.media.reddit_video.fallback_url.replace("?source=fallback", ""),
                isVideo: true,
                extension: "mp4"
            }
        }
        else if (submission.media.type === "gfycat.com")
        {
            return {
                url: submission.media.oembed.thumbnail_url.replace("size_restricted.gif", "mobile.mp4"),
                isVideo: true,
                extension: "mp4"
            }
        }
    }
    else if (submission.crosspost_parent_list !== undefined && submission.crosspost_parent_list.length > 0)
    {
        const crosspostMediaInfo = await findMediaInSubmission(submission.crosspost_parent_list[0])
        if (crosspostMediaInfo !== null)
            return crosspostMediaInfo
    }
    else if (submission.url !== undefined)
    {
        const parsedUrl = url.parse(submission.url)
        const extension = path.extname(parsedUrl.pathname).substring(1)

        if (submission.url.startsWith("https://i.redd.it/"))
        {
            return {
                url: submission.url,
                isVideo: videoExtensions.includes(extension),
                extension: extension
            }
        }
        else if (submission.url.startsWith("https://i.imgur.com/"))
        {
            const imageId = path.basename(parsedUrl.pathname, `.${extension}`)
            return {
                url: `https://imgur.com/download/${imageId}`,
                isVideo: videoExtensions.includes(extension),
                extension: extension
            }
        }
        else
        {
            return new Promise((resolve, reject) => {
                request
                    .head(submission.url)
                    .on("error", err => reject(err))
                    .on("response", function(response) {
                        const contentType = response.headers["content-type"]
                        if (contentType.startsWith("image") || contentType.startsWith("video"))
                        {
                            resolve({
                                url: submission.url,
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
    }

    return null
}

module.exports = {
    findMediaInSubmission
}