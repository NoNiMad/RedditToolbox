function allSettled(promises)
{
    if (Promise.allSettled)
        return Promise.allSettled(promises)

    return Promise.all(
        promises.map(promise =>
            promise
                .then(value => {
                    return { status: "fulfilled", value: value }
                })
                .catch(reason => {
                    return { status: "rejected", reason: reason }
                })
        )
    )
}

async function promptPasswordIfNeeded(password)
{
    if (password !== undefined)
        return password    

    const config = require("./config")
    const inquirer = require("inquirer")
    return (await inquirer.prompt([{
            type: "password",
            name: "password",
            message: `Password for ${config.get("username")}`
        }])).password
}

module.exports = {
    allSettled,
    promptPasswordIfNeeded
}