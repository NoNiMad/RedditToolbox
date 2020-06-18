const { Command, flags } = require("@oclif/command")

class GetCommand extends Command
{
    async run()
    {
        const fs = require("fs")
        const ora = require("ora")
        const utils = require("../lib/utils")
        const media = require("../lib/media")
        const downloader = require("../lib/downloader")

        const spinner = ora()
        const { args, flags } = this.parse(GetCommand)

        let password = await utils.promptPasswordIfNeeded(flags.password)

        // Reddit API //
        spinner.start("Initializing Reddit API")

        const r = await require("../lib/reddit")(password)
        if (r == null)
        {
            spinner.fail()
            this.error("Are you sure your configuration and your credentials are correct?")
        }

        spinner.succeed()

        // Get the content from reddit
        spinner.start("Getting the submission...")

        const submission = await (await r.getSubmission(args.id)).fetch()

        if (flags["download-media"])
        {
            const mediaFound = await media.findMediaInSubmission(submission)
            if (mediaFound !== null)
            {
                spinner.info("Downloading the media...")
                await downloader([{
                    url: mediaFound.url,
                    path: `${args.id}_media.${mediaFound.extension}`
                }])
                spinner.succeed("Media downloaded!")
            }
            else
            {
                spinner.warn("No media found")
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
    password: require("../flags/password")(),
    "download-media": flags.boolean({ char: "d" })
}

module.exports = GetCommand
