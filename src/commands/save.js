const { Command, flags } = require("@oclif/command")

class SaveCommand extends Command
{
    static alises = ['saved']

    async run()
    {
        const fs = require("fs")
        const path = require("path")
        const ora = require("ora")
        const sanitize = require("sanitize-filename")
        const config = require("../lib/config")
        const media = require("../lib/media")

        const spinner = ora()
        const { flags } = this.parse(SaveCommand)

        // Reddit API //
        spinner.start("Initializing Reddit API")

        let r
        try
        {
            r = await require("../lib/reddit").authenticated()
        }
        catch (error)
        {
            spinner.fail()
            this.error("Failed to initialize the connection to the Reddit API.")
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
        const summary = await Promise.all(content.map(async s => {
            let summaryElement = {
                id: s.id,
                permalink: s.permalink,
                subreddit: typeof(s.subreddit) === "string" ? s.subreddit : s.subreddit.display_name,
                title: s.title || s.link_title,
                thumbnail: s.thumbnail,
                medias: []
            }

            try
            {
                const medias = await media.findMediasInSubmission(s)
                if (medias.length > 0)
                {
                    const safeTitle = sanitize(summaryElement.title).substring(0, 50)
                    const safeSubredditName = sanitize(summaryElement.subreddit)
                    const hasMultipleMedias = medias.length > 1

                    medias.forEach((mediaInfo, i) => {
                        const indexIndicator = hasMultipleMedias ? `_${i}` : ""
                        const filename = `${safeTitle}_${summaryElement.id}${indexIndicator}.${mediaInfo.extension}`
                    
                        summaryElement.medias.push({
                            url: mediaInfo.url,
                            isVideo: mediaInfo.isVideo,
                            path: path.join(safeSubredditName, filename),
                        })
                        mediaCount++
                    })
                }
            }
            catch (error)
            {
                /* 99% of the time, the HEAD request failed, which could be the case when:
                    - File is gone
                    - SSL certificates are invalid (if url is https)
                    - Connexion issues (like a timeout)
                   We're just ignoring them
                */
            }

            return summaryElement
        }))

        spinner.info(`Data parsed: ${summary.length} elements, ${mediaCount} medias`)

        // Save files to disk //
        {
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
        }

        let medias = summary
            .map(el => {
                return el.medias.map(media => {
                    return {
                        url: media.url,
                        path: path.join(baseFolder, media.path)
                    }
                })
            })
            .flat()
        
        // Checking existing files //
        if (!flags["no-check"])
        {
            spinner.start("Checking existing media files...")

            let existingMedias = medias.filter(media => fs.existsSync(media.path))
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
                                fs.unlinkSync(existingMedia.path)
                                deletedCount++
                            }
                            else
                            {
                                medias.splice(medias.findIndex(m => m.path === existingMedia.path), 1)
                                validCount++
                            }
                        }
                        else
                        {
                            medias.splice(medias.findIndex(m => m.path === existingMedia.path), 1)
                            errors.push(`${path.basename(existingMedia.path)}: ${result.error}`)
                        }
                    })
                
                if (errors.length != 0)
                {
                    spinner.error(`Checking existing files: ${validCount} valid, ${deletedCount} invalid and ${errors.length} errors`)
                    errors.forEach(err => this.error(err))
                    spinner.error("Files that caused an error won't be re-downloaded")
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
        }

        // Download medias //
        if (medias.length > 0)
        {
            spinner.info(`Downloading ${medias.length} files...`)

            const downloader = require("../lib/downloader")
            try
            {
                await downloader(medias)
            }
            catch (error)
            {
                spinner.error(error)
            }
        }
        else
        {
            spinner.info("Nothing to download")
        }
        
        spinner.succeed("Complete! Your saved content has been successfully updated!")
    }
}

SaveCommand.description = `Backups saved content`

SaveCommand.flags = {
    "no-check": flags.boolean()
}

module.exports = SaveCommand
