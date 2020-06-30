const Conf = require("conf")

const schema = {
	folder: {
        type: "string"
    },
    refreshToken: {
        type: "string"
    }
}

const config = new Conf({
    schema,
    projectSuffix: ""
})

module.exports = config