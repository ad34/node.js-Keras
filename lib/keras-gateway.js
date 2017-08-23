'use strict'

const redis = require("redis")

const uid2 = require('uid2')

var Emitter = require('events').EventEmitter

const requestTypes = 
{
  prediction : 1
}

const kerasGateway = function (config,callback) 
{
    const opts = config.kerasGatewayOpts || {}

    var prefix = 'keras'
    var requestsTimeout = opts.requestsTimeout || 30000

    // init clients 
    const createClient = (opts) =>
    {
        return redis.createClient(config.redisPort ? config.redisPort : 6379 , config.redisHost , opts)
    }

    var pub = createClient({no_ready_check:true})
    var sub = createClient({no_ready_check:true})

    // this server's key
    const nodeId = uid2(8)

    var Gateway = function()
    {
        this.prefix = prefix

        this.requestsTimeout = requestsTimeout

        this.nodeId = nodeId

        this.channel = prefix + '#'
        
        this.requestChannel = prefix + '-predictionRequest#'
        this.responseChannel = prefix + '-predictionResponse#'
        
        this.requests = {}

        this.channelMatches =  (messageChannel, subscribedChannel) =>
        {
            return messageChannel.startsWith(subscribedChannel)
        }
    
        this.pubClient = pub
        this.subClient = sub

        var self = this

        sub.psubscribe(this.channel + '*', function(err)
        {
            if (err) self.emit('error', err)
        });

        sub.on('pmessageBuffer', this.onmessage.bind(this))

        sub.subscribe(this.responseChannel, function(err)
        {
            if (err) self.emit('error', err)
        });

        sub.on('messageBuffer', this.onrequest.bind(this))

        function onError(err) 
        {
            console.log('error', err)
        }

        pub.on('error', onError)
        sub.on('error', onError)

    }

    Gateway.prototype.__proto__ = Emitter.prototype

    Gateway.prototype.onmessage = function(pattern, channel, msg)
    {
        pattern  = pattern.toString('utf8')
        channel  = channel.toString('utf8')
        msg      = msg.toString('utf8')

        if (!this.channelMatches(channel, this.channel)) 
        {   
            // ignore different channel
            return
        }

        msg = JSON.parse(msg)

        // more to come


    }

    Gateway.prototype.onrequest = function(channel, msg)
    {
        channel  = channel.toString('utf8')
        msg      = msg.toString('utf8')
 
        if (this.channelMatches(channel, this.responseChannel)) 
        {
            return this.onresponse(channel, msg)
        } 
        else if (!this.channelMatches(channel, this.requestChannel)) 
        {
            return console.log('ignore different channel')
        }

        var self = this
        var request

        try 
        {
            request = JSON.parse(msg)
        } 
        catch(err)
        {
            console.log("error ", err)
            return
        }

        switch (request.type) 
        {
            default:
                console.log("request of type %s not handled ", request.type)
                break
        }
    }

    Gateway.prototype.onresponse = function(channel, msg)
    {
        var self = this
        var response

        try 
        {
            response = JSON.parse(msg)
        } 
        catch(err)
        {
            self.emit('error', err)
            return
        }

        const requestId = response.requestId

        if (!requestId || !self.requests[requestId]) 
        {
            console.log('ignoring unknown request id ', requestId , msg )
            return
        }

        var request = self.requests[requestId]

         switch (request.type) 
         {
            case requestTypes.prediction:
                clearTimeout(request.timeout)
                
                if (request.callback)
                {
                    process.nextTick(request.callback.bind(null,null,  response.prediction))
                }
                break

            default:
                console.log("unhandled requestType in onresponse")
                break
         }

    }

    // return the number of subscriber to a specific channel 
    Gateway.prototype.getNumSub = (channel,callback) =>
    {
        var self = this

        pub.send_command('pubsub', ['numsub', channel], function(err, numsub)
        {
            if (err) 
            {
                this.emit('error', err)
                if (callback) 
                {
                    callback(err,null)
                }
                return
            }

            numsub = parseInt(numsub[1], 10)
            callback(null,numsub)
        })

    }

    Gateway.prototype.predict = function(inputParams,callback)
    {
        var self = this
        var requestId = uid2(8)

        var request = JSON.stringify(
        {
            requestId   : requestId,
            type        : requestTypes.prediction,
            input       : inputParams
        })

        var timeout = setTimeout(function() 
        {
            var request = self.requests[requestId]

            if (callback) 
            {
                process.nextTick(callback.bind(null,new Error('timeout reached while waiting for prediction response'), null ))
            }

            delete self.requests[requestId]

        }, self.requestsTimeout)

        self.requests[requestId] = 
        {
            type: requestTypes.prediction,
            prediction : [],
            callback: callback,
            timeout: timeout
        }

        pub.publish(self.requestChannel, request)

    }

    Gateway.nodeId = nodeId // the current node id 
    Gateway.pubClient = pub
    Gateway.subClient = sub
    Gateway.prefix = prefix

    Gateway.requestsTimeout = requestsTimeout

    // test the gateway /////
    if (config.testGateway)
    {
        var test = new Gateway()

        const input = [0,0]

      
        test.predict(input, (err,prediction) => 
        {
            if (err)
            {
                console.log(err)
                return
            }
            console.log("prediction with input [%d][%d] - prediction : %f",  input[0],input[1],prediction[0])
        })
       
    }

    return callback(null, {'kerasGateway' : Gateway})
}

module.exports = kerasGateway