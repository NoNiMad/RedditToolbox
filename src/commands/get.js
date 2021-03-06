const { Command, flags } = require("@oclif/command")

class GetCommand extends Command
{
    async run()
    {
        const fs = require("fs")
        const ora = require("ora")
        const media = require("../lib/media")
        const downloader = require("../lib/downloader")

        const spinner = ora()
        const { args, flags } = this.parse(GetCommand)

        // Reddit API //
        spinner.start("Initializing Reddit API")

        let r
        try
        {
            r = await require("../lib/reddit").authenticatedWithFallback()
        }
        catch (error)
        {
            spinner.fail()
            this.error("Failed to initialize the connection to the Reddit API.")
        }

        spinner.succeed()

        // Get the content from reddit
        spinner.start("Getting the submission...")

        let submission
        try
        {
            submission = await r.getSubmission(args.id).fetch()
        } catch (error)
        {
            spinner.fail()
            this.error(`Failed to get submission with id "${args.id}": ${error.message}`)
        }

        if (flags["download-media"])
        {
            const medias = await media.findMediasInSubmission(submission)
            if (medias.length > 0)
            {
                spinner.info(`Downloading ${medias.length} media(s)...`)
                await downloader(medias.map((media, i) => {
                    return {
                        url: media.url,
                        path: `${args.id}_media_${i}.${media.extension}`
                    }
                }))
                spinner.succeed("Media(s) downloaded!")
            }
            else
            {
                spinner.warn("No media found.")
            }
        }

        spinner.start("Writing the JSON post...")
        fs.writeFileSync(`${args.id}.json`, JSON.stringify(submission))
        spinner.succeed("Done!")
    }
}

GetCommand.description = `Get a submission from reddit`

GetCommand.args = [
    {
        name: "id",
        required: "true",
        description: "The id of the submission you want to get"
    }
]

GetCommand.flags = {
    "download-media": flags.boolean({ char: "d" })
}

module.exports = GetCommand
