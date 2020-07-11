const url = require("url")
const http = require("http")
const request = require("request")

const constants = require("./constants")

const possibleErrors = {
    // Server
    INVALID_RESPONSE: {
        message: "Response received is incorrectly formed. It could mean reddit updated its API, but its more likely that this page has been incorrectly accessed.",
        code: 400
    },
    INVALID_REQUEST: {
        message: "The authentication URL contains incorrect parameters... which means API has changed or that I don't know how to code. Please forgive me (and let me know).",
    },
    ACCESS_DENIED: {
        message: "You decided not to give access to your account and that is fine! Some of the features do not require any account.",
        code: 401
    },
    INCORRECT_STATE: {
        message: "The value used to check the authenticity of the request could not be validated. Trying again could help.",
        code: 400
    },
    UNKNOWN: {
        message: "Unknown error received. There may be an indication below.",
        code: 500
    },
    // Token
    TOKEN_REQUEST_FAILED: {
        message: "The request for tokens failed unexpectedly. See message below for more information.",
    },
    JSON_PARSE_ERROR: {
        message: "Parsing the reponse failed... it could mean that the reddit url has changed or that there is an issue with the request."
    },
    TOKEN_INVALID_REQUEST: {
        message: "The request for tokens contains incorrect parameters... which means API has changed or that I don't know how to code. Please forgive me (and let me know).",
    }
}

async function getCode(log)
{
    return new Promise((resolve, reject) =>
    {
        const state = require('crypto').randomBytes(16).toString('base64')

        const server = http.createServer((req, res) => {
            const query = url.parse(req.url, true).query
    
            // Reddit answers with an explicit error
            if (query.error !== undefined)
            {
                const errorObject = new Error(query.error)
                switch (query.error)
                {
                    case "access_denied":
                        sendErrorAndReject("ACCESS_DENIED", errorObject)
                        break
                    case "unsupported_response_type":
                    case "invalid_scope":
                    case "invalid_request":
                        sendErrorAndReject("INVALID_REQUEST", errorObject)
                        break
                    default:
                        sendErrorAndReject("UNKNOWN", errorObject)
                        break
                }
                return
            }
    
            // Invalid answer
            if (query.state === undefined || query.code === undefined)
                return sendErrorAndReject("INVALID_RESPONSE")
    
            // Checking state value
            if (query.state !== state)
                return sendErrorAndReject("INCORRECT_STATE")
    
            // Success
            send(res, 200, "Authentication successful. You can now close this page!")
            server.close()
            resolve(query.code)
            
            function send(res, code, message)
            {
                res.writeHead(code, { 'Content-Type': 'text/html' })
                res.write(`<p>${message.replace(new RegExp("\n", "g"), "<br>")}</p>`)
                res.end()
            }

            function sendErrorAndReject(errorType, errorObject)
            {
                const error = possibleErrors[errorType]
                const fullMessage = error.message + (errorObject !== undefined ? `\nOriginal error message: ${errorObject.message}` : "")
    
                send(res, error.code, fullMessage)
                server.close()
                reject(new Error(fullMessage))
            }
        })
        server.listen(constants.oauth.port)

        const authUrl = getAuthenticationUrl(state)
        log(authUrl)
        require('open')(authUrl)

        function getAuthenticationUrl(state)
        {
            return `${constants.oauth.baseUrl}authorize?` + require("querystring").stringify({
                client_id: constants.clientId,
                response_type: "code",
                state,
                redirect_uri: constants.oauth.redirectUrl,
                duration: "permanent",
                scope: constants.oauth.scopes,
            })
        }
    })
}

async function getRefreshToken(code)
{
    return new Promise((resolve, realReject) =>
    {
        request
            .post({
                uri: `${constants.oauth.baseUrl}access_token`,
                auth: {
                    user: constants.clientId,
                    pass: ""
                },
                form: {
                    grant_type: 'authorization_code',
                    code: code,
                    redirect_uri: constants.oauth.redirectUrl
                },
            }, (err, _, body) => {
                if (err)
                {
                    reject("TOKEN_REQUEST_FAILED", err)
                    return
                }

                try
                {
                    const parsedBody = JSON.parse(body)
                    if (parsedBody.error !== undefined)
                        return reject("TOKEN_INVALID_REQUEST", new Error(parsedBody.error))
                
                    resolve(parsedBody.refresh_token)
                }
                catch (jsonError)
                {
                    return reject("JSON_PARSE_ERROR", jsonError)
                }
            })
        
        function reject(errorType, errorObject)
        {
            const error = possibleErrors[errorType]
            realReject(new Error(error.message + (errorObject !== undefined ? `\nOriginal error message: ${errorObject.message}` : "")))
        }
    })
}

module.exports = {
    getCode,
    getRefreshToken
}
