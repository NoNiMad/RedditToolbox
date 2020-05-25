const Conf = require("conf")

const schema = {
	folder: {
        type: 'string'
    },
    clientId: {
        type: "string"
    },
    clientSecret: {
        type: "string"
    },
    username: {
        type: "string"
    }
}

const config = new Conf({
    schema,
    projectSuffix: ""
})

module.exports = config