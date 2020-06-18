const snoowrap = require("snoowrap")
const config = require("../lib/config")

module.exports = async function (password)
{
    try
    {
        const r = new snoowrap({
            userAgent: "desktop:RedditToolbox:v0.0.1 (by /u/NoNiMad)",
            clientId: config.get("clientId"),
            clientSecret: config.get("clientSecret"),
            username: config.get("username"),
            password: password
        })

        // This checks if the credentials are valid
        await r.getMe()

        return r
    }
    catch(e)
    {
        return null
    }
}