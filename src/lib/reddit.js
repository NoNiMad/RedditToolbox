const snoowrap = require("snoowrap")
const constants = require("../lib/constants")
const config = require("../lib/config")

async function authenticated()
{
    const r = new snoowrap({
        userAgent: constants.userAgent,
        clientId: constants.clientId,
        clientSecret: "",
        refreshToken: config.get("refreshToken")
    })

    // This checks if the credentials are valid
    await r.getMe()

    return r
}

async function userLess()
{
    const r = await snoowrap.fromApplicationOnlyAuth({
        userAgent: constants.userAgent,
        clientId: constants.clientId,
        deviceId: "DO_NOT_TRACK_THIS_DEVICE"
    })

    return r
}

async function authenticatedWithFallback()
{
    if (config.get("refreshToken") !== undefined)
    {
        try
        {
            const r = await authenticated()
            return r
        }
        catch
        {
        }
    }

    return await userLess()
}

module.exports = {
    authenticated,
    userLess,
    authenticatedWithFallback
}