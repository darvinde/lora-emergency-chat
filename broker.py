import sys
import time
import zmq
import threading
from driver.best_LoRa_driver import LoRa

import ast
import json
from google.protobuf.json_format import ParseDict, MessageToJson
import protobuf.emergency as emergency

# standard address for broker = 0
broker_address = 0
lora = LoRa(broker_address)

# Receive message from LoRa and process depending on the type
# Type 1 = Broadcast, 2 = Setup, 3 = chat message, 4 = emergency message, 5 = error
def receive():
    # Socket for exchanging messages with the webserver
    contextzmq = zmq.Context()
    socketsend = contextzmq.socket(zmq.REQ) # Request Socket
    socketsend.connect("tcp://127.0.0.1:4202")

    # Socket for exchaning data with the database
    contextzmq = zmq.Context()
    broker = contextzmq.socket(zmq.REQ) # Request Socket
    broker.connect("tcp://localhost:5555")

    while 1:
        # Receive a message from Lora
        msg_arr = lora.receive()
        for msg in msg_arr:
            print("Lora received: " + str(msg))
            if msg == False: continue

            # Translate protobuf to Json
            protochatmessage = emergency.Main()
            try:
                protochatmessage.ParseFromString(msg)
            except:
                print("Broker: Could not parse bytes to proto message")

            # check if the receiver of the message is broker
            if(protochatmessage.receiver_address != 0):
                # discard message
                break

            # check message type
            if(protochatmessage.type == 1):
                broadcast(protochatmessage, broker) 
            elif (protochatmessage.type == 3 or protochatmessage.type == 4):
                new_message = protochatmessage
                # load the stored path to the end receiver
                new_message.send_to_path = protochatmessage.path + ',0;' + str(lora.all_channel)[1: -1].replace(' ', '')
                
                try:
                    jsondata = MessageToJson(protochatmessage, preserving_proto_field_name=True)
                except:
                    print("ERROR: Could not parse proto message to Json")
                    break

                # Sending the whole Protobuf to update the broker
                broker.send(jsondata.encode("UTF-8"))
                # await answer from broker
                message = broker.recv()
                print("BROKER MESSAGE UPDATED\n")

                # load path to end receiver from database
                dict_for_jason = {"sender_address":protochatmessage.end_receiver_address}
                jason = json.dumps(dict_for_jason, indent = 4)
                #print(jason)
                #print(jason.encode("UTF-8"))
                broker.send(jason.encode("UTF-8"))
                
                msg = broker.recv()
                try:
                    msg_dict = json.loads(msg.decode("UTF-8"))
                except:
                    print("ERROR: path was not found in database for address: " + str(protochatmessage.end_receiver_address))
                    break

                new_message.send_to_path = str(msg_dict["path"]) + ",0;" + str(lora.all_channel)[1: -1].replace(' ', '')
                #print(new_message.send_to_path)
                #print(new_message.send_to_path.split(';')[0])
                #print(new_message.send_to_path.split(';')[0].split(","))
                try:
                    send_to_path = new_message.send_to_path.split(';')[0].split(",")
                    new_message.receiver_address = int(send_to_path[len(send_to_path)-2])
                    new_message.end_receiver_address = int(send_to_path[0])
                except:
                    print("ERROR: Path could not be calculated right")
                    break
                lora_to_lora(new_message, 1)

def broadcast(protochatmessage, broker):
     # Parse proto to json
    try:
        jsondata = MessageToJson(protochatmessage, preserving_proto_field_name=True)
    except:
        print("ERROR: Could not parse proto message to Json")
        return

    # Sending the whole Protobuf to update the broker
    #print(jsondata.encode("UTF-8"))
    broker.send(jsondata.encode("UTF-8"))

    # await answer from broker
    message = broker.recv()
    print("BROKER NODES UPDATED\n")

    # save all active channel 
    channel = protochatmessage.path.split(',') #this should work lol
    for cha in channel:
        lora.all_channel.add(int(cha))
    #print(str(lora.all_channel))

    # prepare message for setup
    new_message = emergency.Main()
    new_message.sender_address = broker_address
    new_message.receiver_address = -1 # set later
    new_message.path = str(broker_address)
    new_message.send_to_path = "" # init, write later
    new_message.sender_time = round(time.time()*1000)
    new_message.location = "Paderborn"
    new_message.name = "Broker"
    new_message.type = 2 # type for setup
    new_message.end_receiver_address = -1 # init, write later
    new_message.text = "This is setup"

    # load path to end receiver from database
    dict_for_jason = {"sender_address":protochatmessage.sender_address}
    jason = json.dumps(dict_for_jason, indent = 4)
    broker.send(jason.encode("UTF-8"))
    msg = broker.recv()
    try:
        msg_dict = json.loads(msg.decode("UTF-8"))
    except:
        print("ERROR: path was not found in database for address: " + str(protochatmessage.sender_address))
        return
    new_message.send_to_path = str(msg_dict["path"]) + ",0;" + str(lora.all_channel)[1: -1].replace(' ', '')
    try:
        send_to_path = new_message.send_to_path.split(';')[0].split(",")
        new_message.receiver_address = int(send_to_path[len(send_to_path)-2])
        new_message.end_receiver_address = int(send_to_path[0])
        #print(send_to_path)
    except:
        print("ERROR: Path could not be calculated right")
        return

    # use stored shortest path
    # unneccessary, cause we have a database now Johannes
    # new_message.send_to_path = protochatmessage.path + ',0;' + str(lora.all_channel)[1: -1].replace(' ', '') #THE FIRST ENTRY IS THE RECEIVER, THE LAST ENTRY IS THE SENDER after ; CHANNEL LIST
    lora_to_lora(new_message, 1)
    print("\n BROKER: Broadcast finished, Setup started\n")

# Receive message from User and send over LoRa
def web_to_lora():
    
    # Socket for receiving messages from Website
    contextzmq = zmq.Context()
    socketreceive = contextzmq.socket(zmq.REP) #Response Socket
    socketreceive.bind("tcp://*:4201")

    while 1:
        msg = socketreceive.recv()

        # msg_dict contains receiver address, type, sender_time, name, is_emergency, text
        try:
            msg_dict = json.loads(msg.decode("UTF-8"))
        except:
            print("Could not parse json msg from webserver")
            continue
        # Prepare dict for parsing
        #print("Now print msg_dict" + str(msg_dict))
        msg_dict["sender_address"] = broker_address
        msg_dict["path"] = str(broker_address)
        msg_dict["location"] = "51.6;8.1"

        protochatmessage = emergency.Main()

        #print(msg_dict)
        #print(protochatmessage)
        print("---------------------------------------")

        # Parse Json to proto message
        msg = ParseDict(msg_dict, protochatmessage, ignore_unknown_fields=True) 

        lora_to_lora(msg, 0)

        # Send response
        socketreceive.send(b'{"success":true,"responsemessage":"From PY: Successfully received the message!"}')

# Send messages via LoRa
def lora_to_lora(msg, seconds):
    print("Sending: LoRa to LoRa\n")
    #print(msg)
    time.sleep(seconds)
    data = msg.SerializeToString()
    lora.send(data, True)

# Threading for simultaniously send and receive via LoRa
t1 = threading.Thread(target = receive)
t2 = threading.Thread(target = web_to_lora)

t1.start()
t2.start()  
