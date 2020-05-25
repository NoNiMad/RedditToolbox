const { Command } = require("@oclif/command")

const fs = require("fs")
const path = require("path")

function getSubredditName(element)
{
    return typeof(element.subreddit) === "string" ? element.subreddit : element.subreddit.display_name
}

function getMediaInfoFromPost(post)
{
    if (post.media !== undefined && post.media !== null)
    {
        if (post.media.reddit_video !== undefined)
        {
            return {
                url: post.media.reddit_video.fallback_url.replace("?source=fallback", ""),
                extension: "mp4"
            }
        }
        else if (post.media.type === "gfycat.com")
        {
            return {
                url: post.media.oembed.thumbnail_url.replace("size_restricted.gif", "mobile.mp4"),
                extension: "mp4"
            }
        }
    }
    else if (post.url !== undefined && post.url.startsWith("https://i.redd.it/"))
    {
        return {
            url: post.url,
            extension: post.url.substring(post.url.length - 3)
        }
    }

    return null
}

function toDownloaderStruct(baseFolder, mediaInfo)
{
    const sanitize = require("sanitize-filename")

    let safeTitle = sanitize(mediaInfo.title)
    if (safeTitle.length > 50)
        safeTitle = safeTitle.substring(0, 50)

    let safeSubredditName = sanitize(mediaInfo.subreddit)
    let filename = `${safeTitle}_${mediaInfo.id}.${mediaInfo.extension}`

    return {
        url: mediaInfo.url,
        filename: filename,
        folder: path.join(baseFolder, safeSubredditName),
        localPath: path.join(safeSubredditName, filename),
        absolutePath: path.join(baseFolder, safeSubredditName, filename),
    }
}

class SavedCommand extends Command
{
    async run()
    {
        const ora = require("ora")
        const config = require("../lib/config")
        const utils = require("../lib/utils")

        const spinner = ora()
        const { flags } = this.parse(SavedCommand)

        let password = await utils.promptPasswordIfNeeded(flags.password)

        // Reddit API //
        spinner.start("Initializing Reddit API")

        let r = await require("../lib/reddit")(password)
        if (r == null)
        {
            spinner.fail()
            this.error("Are you sure your configuration and your credentials are correct?")
        }

        spinner.succeed()

        // Load local data //
        spinner.start("Loading content from disk...")

        const baseFolder = config.get("folder")
        if (baseFolder == undefined)
        {
            spinner.fail()
            this.error("The path indicated in the configuration is invalid. Please run *RedditToolbox config* and set a valid path.")
        }

        const contentFile = path.join(baseFolder, "content.js")
        const summaryFile = path.join(baseFolder, "summary.js")
        
        let content = []
        if (fs.existsSync(contentFile))
        {
            let text = fs.readFileSync(contentFile, "utf8")
            content = JSON.parse(text)
            spinner.info(`${content.length} elements found locally`)
        }
        else
        {
            spinner.info("No data found locally")
        }

        // Load new elements from Reddit //
        {
            spinner.start("Loading new content from Reddit...")

            // Get saved content until we find one we already have locally
            let newContent = await r.getMe().getSavedContent({ limit: 50 })
            while (!newContent.isFinished
                && content.find(c => c.id === newContent[newContent.length - 1].id) === undefined)
            {
                newContent = await newContent.fetchMore({ amount: 50 })
            }
            // Filter all the content we already have (may happen if we add/remove the same saved stuff)
            newContent = newContent.filter(newEl => content.find(el => el.id === newEl.id) === undefined)

            // Put the new content before the existing one
            content = newContent.concat(content)

            spinner.succeed(`${newContent.length} new elements found online`)
        }

        // Parse content //
        spinner.start("Parsing data...")

        let mediaCount = 0
        let summary = content
            .map(s => {
                let summaryElement = {
                    id: s.id,
                    permalink: s.permalink,
                    subreddit: getSubredditName(s),
                    title: s.title || s.link_title,
                    thumbnail: s.thumbnail
                }

                let mediaInfo = getMediaInfoFromPost(s)
                if (mediaInfo != null)
                {
                    summaryElement.media = toDownloaderStruct(
                        baseFolder,
                        {
                            ...summaryElement,
                            ...mediaInfo
                        })
                    mediaCount++
                }

                return summaryElement
            })

        spinner.info(`Data parsed: ${summary.length} elements, ${mediaCount} medias`)

        // Save files to disk //
        spinner.start("Writing content to disk...")

        fs.mkdirSync(baseFolder, { recursive: true })

        fs.writeFileSync(
            path.join(baseFolder, "index.html"),
            fs.readFileSync(path.join(__dirname, "../assets/saved.html")))

        // Write the data we received from reddit, to enable further parsing later
        fs.writeFileSync(contentFile, JSON.stringify(content))

        // Write the summary used by the HTML page (with the variable declaration)
        fs.writeFileSync(summaryFile, `let content = ${JSON.stringify(summary)}`)
        
        spinner.succeed("Content successfully saved")

        // Checking existing files //
        spinner.start("Checking existing media files...")
        let medias = summary
            .filter(el => el.media != undefined)
            .map(el => el.media)

        let existingMedias = medias.filter(media => fs.existsSync(media.absolutePath))
        if (existingMedias.length > 0)
        {
            spinner.text = `${existingMedias.length} media files being checked...`
            
            const checker = require("../lib/checker")
            let results = await checker(existingMedias)

            let validCount = 0
            let deletedCount = 0
            let errors = []
            results
                .forEach((result, i) => {
                    let existingMedia = existingMedias[i]
                    if (result.success)
                    {
                        if (result.needDownload)
                        {
                            fs.unlinkSync(existingMedia.absolutePath)
                            deletedCount++
                        }
                        else
                        {
                            medias.splice(medias.findIndex(m => m.absolutePath === existingMedia.absolutePath), 1)
                            validCount++
                        }
                    }
                    else
                    {
                        medias.splice(medias.findIndex(m => m.absolutePath === existingMedia.absolutePath), 1)
                        errors.push(`${existingMedia.filename}: ${result.error}`)
                    }
                })
            
            if (errors.length != 0)
            {
                spinner.warn(`Checking existing files: ${validCount} valid, ${deletedCount} invalid and ${errors.length} errors`)
                errors.forEach(err => this.error(err))
                this.error("Errored files won't be re-downloaded.")
            }
            else
            {
                spinner.info(`Checking existing files: ${validCount} valid and ${deletedCount} invalid`)
            }
        }
        else
        {
            spinner.info("No files found locally")
        }

        // Download medias //
        if (medias.length > 0)
        {
            spinner.info(`Downloading ${medias.length} files...`)

            const downloader = require("../lib/downloader")
            await downloader(medias)
        }
        else
        {
            spinner.info("Nothing to download")
        }
        
        spinner.succeed("Complete! Your saved content has been successfully updated!")
    }
}

SavedCommand.description = `Backups saved content`

SavedCommand.flags = {
    password: require("../flags/password")()
}

module.exports = SavedCommand
