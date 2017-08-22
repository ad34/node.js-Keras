module.exports = () =>
{
    exports.kerasGatewayOpts = {}
    exports.testGateway = true   

    exports.redisPort = 6379
    exports.redisDb   = 0
    exports.redisHost = "localhost"

    exports.requestsTimeout = 10000

    return exports
}