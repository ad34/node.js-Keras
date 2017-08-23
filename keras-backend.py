import sys, random

import numpy as np
from keras.models import Sequential,load_model
from keras.layers import Dense, Dropout, Activation
from keras.optimizers import SGD

import signal,os,time
import datetime
import redis
import json

import threading

r = redis.StrictRedis(host='localhost', port=6379, db=0)

p = r.pubsub()

predictionQueue = []

lock = threading.Lock()

def predictionHandler():
    global r,model
    while True:
        
        if len(predictionQueue)>0:
            try:
                lock.acquire()
                d = predictionQueue.pop(0)
                lock.release()
                data = json.loads(d)

                if data['type'] == 1:
       
                    prediction = model.predict(np.array(data['input']).reshape(-1,2))

                    response = {'requestId' : data['requestId'],'prediction' : prediction[0].tolist(),'type':data['type']}

                    r.publish('keras-predictionResponse#', json.dumps(response))

            except Exception as e:
                print "exception", str(e)

        time.sleep(0.001)


def channel_handler(message):
    global r,model
    lock.acquire()
    predictionQueue.append(message['data'])
    lock.release()
   

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

threading.Thread(target=predictionHandler).start()




