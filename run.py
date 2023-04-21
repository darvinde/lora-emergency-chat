import sys
import os

try:
    if(sys.argv[1] == '-mgw'):

        import network_layer

        try:
            #start broadcast
            my_node_address = int(sys.argv[2])
            network_layer.start_setup(my_node_address)
            print("Broadcast startet")

            #start website
            cwd = os.getcwd()
            cwd += "/Web"
            os.chdir(cwd)
            os.system("node server.js")
            print("Website started")
        except TypeError:
            print("The second parameter needs to be the address as an integer")
        except Exception as e:
            print(str(e))

    elif(sys.argv[1] == '-bro'):

        import broker
        print("Broker network layer started")

        try:
            os.chdir("/home/pi/server")
            os.system("node server.js")
            print("Broker started")

            cwd = os.getcwd()
            cwd += "/Web"
            os.chdir(cwd)
            os.system("node server.js")
            print("Website Started")
        except Exception as e:
            print(str(e))
            print("This probably was not the Pi configured to be the broker. The Path was wrong!!")
except Exception as e:
    print(str(e))
    print('Run with -mgw or -bro')
