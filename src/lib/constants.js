const port = 53917

module.exports = {
    userAgent: "desktop:RedditToolbox:v0.3.0 (by /u/NoNiMad)",
    clientId: "SYSgJj3VOH_uHw",
    oauth: {
        baseUrl: "https://www.reddit.com/api/v1/",
        port,
        redirectUrl: `http://localhost:${port}/authorize_callback`,
        scopes: "history identity read"
    }
}