import sys, random

import numpy as np
from keras.models import Sequential,load_model
from keras.layers import Dense, Dropout, Activation
from keras.optimizers import SGD

import signal,os
import datetime
import redis
import json

r = redis.StrictRedis(host='localhost', port=6379, db=0)

p = r.pubsub()

def channel_handler(message):
    global r,model
    #print ("message in channel ", message['data'])

    try:
        data = json.loads(message['data'])

        if data['type'] == 1:
            print "input ", data['input']

            prediction = model.predict(np.array(data['input']).reshape(-1,2))

            response = {'requestId' : data['requestId'],'prediction' : prediction[0].tolist(),'type':data['type']}

            r.publish('keras-predictionResponse#', json.dumps(response))

    except Exception as e:
        print "exception", str(e)

p.subscribe(**{'keras-predictionRequest#' : channel_handler } )

X = np.array([[0,0],[0,1],[1,0],[1,1]])
y = np.array([[0],[1],[1],[0]])

model = Sequential()
model.add(Dense(8, input_dim=2))
model.add(Activation('tanh'))
model.add(Dense(1))
model.add(Activation('sigmoid'))

sgd = SGD(lr=0.1)
model.compile(loss='binary_crossentropy', optimizer=sgd)

model.fit(X, y, batch_size=1, epochs=150)

print (model.predict(np.array([0,0]).reshape(-1,2)))


thread = p.run_in_thread(sleep_time=0.001)




