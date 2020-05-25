const { flags } = require("@oclif/command")

module.exports = flags.build({
    char: 'p',
    description: 'Password of the configured account'
})