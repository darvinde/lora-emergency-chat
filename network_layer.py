import sys
import time
import zmq
import threading
from driver.best_LoRa_driver import LoRa

import ast
import json
from google.protobuf.json_format import ParseDict, MessageToJson
import protobuf.emergency as emergency

my_node_address = int(sys.argv[2])
lora = LoRa(my_node_address)

# Receive message from LoRa and send to Webserver (To a user)
def lora_to_web():
    # Socket for sending messages to Website
    contextzmq = zmq.Context()
    socketsend = contextzmq.socket(zmq.PUSH) # Request Socket
    socketsend.bind("tcp://*:4201")

    while 1:
        # Receive a message from Lora
        msg_arr = lora.receive()
        long_msg = b""

        for msg in msg_arr:
            # print("Lora received: " + str(msg))
            if msg == False: continue
            long_msg = long_msg + msg

        if(long_msg == b""):
            continue

        # Protobuf to Json
        protochatmessage = emergency.Main()
        try:
            protochatmessage.ParseFromString(long_msg)
        except:
            print("ERROR: Could not parse bytes to proto message")
            
        if(protochatmessage.receiver_address == my_node_address):
            print("\nRECEIVED LORA ------------------------ RECEIVED LORA")
        print("NETWORK LAYER: WIR KOMMEN BIS 51")
        # Check what type of message arrived
        if(protochatmessage.type == 1):
            broadcast(protochatmessage)
        elif(protochatmessage.type == 2):
            setup(protochatmessage)
        elif(protochatmessage.type == 3 or protochatmessage.type == 4):
            chatmessage(protochatmessage, socketsend)
        elif(protochatmessage.type == 5):
            error(protochatmessage)
        elif(protochatmessage.type == 0):
            continue
        else:
            print("ERROR: Invalid message type " + str(protochatmessage.type))


# Receive message from website and send over LoRa
def web_to_lora():

    # Socket for receiving messages from Website
    contextzmq = zmq.Context()
    socketreceive = contextzmq.socket(zmq.PULL) # Response Socket
    socketreceive.connect("tcp://127.0.0.1:4202")

    while 1:
        
        #print("Web_to_LoRa Semaphore acquired")
        msg = socketreceive.recv()
        print("Received a message from website / user over sockets.")

        # Json msg_dict contains type, sender_time, name, text
        msg_dict = json.loads(msg.decode("UTF-8"))

        # Adding info that is needed for the full json to proto parse
        msg_dict["sender_address"] = my_node_address
        msg_dict["path"] = str(my_node_address)
        # Use stored path to the broker
        msg_dict["send_to_path"] = ','.join(lora.shortest_path[::-1])
        
        protochatmessage = emergency.Main()

        print("\nSENDING A CHATMESSAGE -------- SENDING A CHATMESSAGE")
        # Parse json to proto
        msg = ParseDict(msg_dict, protochatmessage, ignore_unknown_fields=True)

        msg.end_receiver_address = msg.receiver_address
        msg.receiver_address = int(lora.shortest_path[0])

        lora_to_lora(msg, 0)

        # Send response
        #socketreceive.send(b'{"success":true, "responsemessage":"From PY: Successfully received the message!"}')

def broadcast(protochatmessage):
    # Check if message was already received once
    path_entries = protochatmessage.path.split(",")
    broadcast = True
    if(protochatmessage.sender_time in lora.message_id_list):
        print("Network_Layer, Line: 104 Discard, Broadcast already sent")
        return
    for entry in path_entries:
        if int(entry) == my_node_address:
            # Message already received once
            broadcast = False
            break
    if broadcast:
        print("\nBROADCAST ---------------------- BROADCAST")
        protochatmessage.path = protochatmessage.path + ',' + str(my_node_address)
        lora_to_lora(protochatmessage, 0.5 + my_node_address / 10)

def setup(protochatmessage):

    if(protochatmessage.receiver_address != my_node_address):
        print("\nDISCARD SETUP MESSAGE\n")

    else:
        print("\nSETUP -------------------- SETUP")
        protochatmessage.path = protochatmessage.path + ',' + str(my_node_address)

        # send_to_path is something like "<Path>;<Channel>" send by broker
        path_channel = protochatmessage.send_to_path.replace(' ', '')

        # Split path and channel to ["<Path>";"<Channel>"]
        path_channel = path_channel.split(';')

        # path_arr = [<Path_Nodes,_,_,BROKER>]
        path_arr = path_channel[0].split(',') 

        # Position of my_node_address in <Path>
        index_my_node_address = path_arr.index(str(my_node_address)) 
        # Gives shortest path to broker saves it as array
        shortest_path_buffer = path_arr[index_my_node_address+1:] 

        if len(lora.shortest_path) > len(shortest_path_buffer) or lora.shortest_path == []:
            lora.shortest_path = shortest_path_buffer

        # Convert string "<Channel>" into array
        channel_arr = path_channel[1].split(',')
        for cha in channel_arr:
            lora.all_channel.add(int(cha))
        
        # Print status for this specific pi
        
        if(index_my_node_address == 0):
            # End receiver reached, setup is completed
            print("\nSETUP FINISHED - PROPPERTIES:")
            print("Shortest path from "+ str(my_node_address) + " to the broker is: " + str(lora.shortest_path))
            print("All active channels currently are: "+ str(lora.all_channel))
        else:
            # Send message on
            remaining_path = path_arr[:index_my_node_address]
            #print("remaining_path", remaining_path)

            if(remaining_path != []):
                next_address = int(remaining_path[-1])
                protochatmessage.receiver_address = next_address
                protochatmessage.sender_address = my_node_address

                # Add this node to path
                protochatmessage.path = protochatmessage.path + ',' + str(my_node_address)
                lora_to_lora(protochatmessage, 0.5 + my_node_address / 10)


# Add the current node to the path, and prepare lora message for the next receiver.
# If oneself is the receiver, it will be redirected to the website
def chatmessage(protochatmessage, socketsend):
    if(protochatmessage.receiver_address == my_node_address):

        path = protochatmessage.send_to_path.split(',')
        try:
            my_address_index = path.index(str(my_node_address))
        except:
            print("ERROR: Path did not contain address")
            
        if(protochatmessage.end_receiver_address == my_node_address):
            # End node reached, send to web
            print("\nMESSAGE RECEIVED\n")
            try:
                jsondata = MessageToJson(protochatmessage, preserving_proto_field_name=True)
            except:
                print("ERROR: Could not parse proto message to Json")
                return
            socketsend.send(jsondata.encode("UTF-8"))
            print(jsondata)
            #lasagne_isnt_delicious = socketsend.recv()            
        else:
           # Send message to next address in path
            protochatmessage.sender_address = my_node_address
            protochatmessage.receiver_address = int(path[my_address_index-1])
            protochatmessage.path = protochatmessage.path + ',' + str(my_node_address)
            lora_to_lora(protochatmessage, 0.5 + my_node_address / 10)
    else:
        print("\nDISCARD MESSAGE\n")
        return

def emergencymessage(protochatmessage):
    return

def error(protochatmessage):
    return

# This method will start the broadcast to find the shortest path to the broker
def start_setup(node_address):
    global my_node_address
    print("Setup for this device started\n")
    my_node_address = node_address

    # Initiate new setup message
    Broadcast_message = emergency.Main()
    Broadcast_message.type = 1
    Broadcast_message.sender_address = my_node_address
    Broadcast_message.receiver_address = 0
    Broadcast_message.path = str(my_node_address)
    Broadcast_message.location = "hier"
    Broadcast_message.sender_time = round(time.time()*1000)
    Broadcast_message.name = "Channel " + str(my_node_address)
    lora_to_lora(Broadcast_message, 0)

# Send a previously defined protobuf message over LoRa
def lora_to_lora(msg, seconds):
    if len(lora.message_id_list) > 100:
        lora.message_id_list = lora.message_id_list[1:]
    lora.message_id_list.append(msg.sender_time)
    data = msg.SerializeToString()
    time.sleep(seconds)
    lora.send(data, False)

start_setup(my_node_address)
# Use threads for simultaniously send and receive via LoRa
t1 = threading.Thread(target = lora_to_web)
t2 = threading.Thread(target = web_to_lora)

t1.start()
t2.start()
