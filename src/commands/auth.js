const { Command } = require('@oclif/command')

class AuthCommand extends Command
{    
    async run()
    {
        const ora = require("ora")
        const auth = require("../lib/oauth")
        const config = require("../lib/config")

        const spinner = ora()

        try
        {
            spinner.start("Authenticating your account...")
            const code = await auth.getCode()
            spinner.succeed("Authentication successful!")
            
            spinner.start("Getting your token...")
            const refreshToken = await auth.getRefreshToken(code)
            spinner.succeed("Token received!")

            spinner.start("Saving your token...")
            config.set("refreshToken", refreshToken)
            spinner.succeed("You can now use the authenticated parts of the app!")

            this.log("Waiting for the temporary HTTP server to shutdown...")
        }
        catch (error)
        {
            spinner.fail()
            this.error(error.message)
        }
    }
}

AuthCommand.description = `Connect your reddit account`

module.exports = AuthCommand
