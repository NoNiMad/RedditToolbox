const { Command } = require('@oclif/command')

class ConfigCommand extends Command
{    
    async run()
    {
        const config = require("../lib/config")
        const inquirer = require('inquirer')

        let fields = [
            {
                name: "folder",
                message: "Local storage folder"
            }
        ]

        await inquirer.prompt(fields.map(field => {
            return {
                type: "input",
                name: field.name,
                message: field.message,
                default: config.get(field.name),
                validate: input => {
                    try
                    {
                        config.set(field.name, input)
                        return true
                    }
                    catch (e)
                    {
                        return e.message
                    }
                }
            }
        }))

        this.log("Config has successfully been saved!")
    }
}

ConfigCommand.description = `Configure your toolbox`

module.exports = ConfigCommand
