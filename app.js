'use strict'

const config        = require("./config")()
const async         = require("async")

const kerasGateway = require("./lib/keras-gateway")

const initData = 
{
    kerasGateway : (callback) =>
    {
        kerasGateway(config,callback)
    }

}

const initialize = (callback) =>
{

    async.parallel(initData, (err, components) =>
    {

    })

}

if (require.main === module)
{
    initialize( (err, app) =>
	{

    })
}


