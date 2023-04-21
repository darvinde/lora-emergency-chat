/*
 This file is for socket.io websockets and 2 zeromq sockets for LoRa communication with python
*/


exports.start_sockets = function(server) {

    var io = require('socket.io')(server);
    var zmq = require("zeromq");


    /*Socket for sending messages to LoRa*/
    var socketsend = zmq.socket('push'); //Request socket
    socketsend.bind("tcp://*:4202");
    console.log("Connected port 4201 socket_send!")

    /*Socket for receiving messages from LoRa*/
    var socketreceive = zmq.socket('pull'); //Response socket
    socketreceive.connect("tcp://localhost:4201");
    console.log("Connected port 4202 socket_receive!")


    /*Websocket on connection: If a user connects to a channel*/
    io.on('connection', (websocket) => {

        /*Get channel id from socket query parameter*/
        let channelid = websocket.handshake.query.channelid;

        /*Get option if from all channels should be received from socket query parameter*/
        let channels_recv_all = websocket.handshake.query.channels_recv_all;
        channels_recv_all = channels_recv_all == "true";

        /*
         Client connect and disconnect to websocket handling
        */
        console.log('a user connected on channel ' + channelid + ".");
        websocket.on('disconnect', () => {
            console.log('user disconnected');
        });


        /*
         When a message from client is received over websocket
         Forward to Lora with socketsend
        */
        websocket.on("message", (buffer) => {
            socketsend.send(JSON.stringify(buffer));
            //callback({success: true, type: "response", responsemessage: "Everything is fine."});
            console.log("Received message from user, sending it to LoRa:")
            console.log(buffer);
        });


        /*
         When a message from LoRa is received
         Forward it via websockets to the correct clients, that have open the correct channel
        */
        socketreceive.on('message', function(msg) {
            msg = JSON.parse(msg.toString());

            console.log("Received a message from Python")
            console.log(msg)

            /*Only send to a client if channel is correct
            Or if user wants to receive from all channels (channels_recv_all option)*/

            if(msg.sender_address == channelid || channels_recv_all){
                websocket.emit("message", JSON.stringify(msg));
            }   

            /*Send success response*/
            //socketreceive.send('{"success":true", "responsemessage":"From JS: Successfully received the message!"}');
        });
        

        /*
         Handling response of the socketsend
        */
        socketsend.on('message', function(msg) {
            msg = JSON.parse(msg.toString()); //Send as buffer via socket
            console.log("Received a response: " + JSON.stringify(msg));
        });

    
    /*Websocket end*/
    });

}