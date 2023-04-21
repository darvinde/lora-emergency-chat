/*
 Main javascript file for the chat
*/

/* 
 We are using multiple message types across the LoRa system
 MESSAGE TYPES:
 3 Chat message
 4 Emergency message
 5 Error
*/

/*
 Code inside this DOMContentLoaded event will run when the DOM is ready
 Code has full access on the DOM
*/
document.addEventListener("DOMContentLoaded", function(event) {


    /*
     Connect to backend websocket and send channelid as a query parameter
    */
    const socket = io(window.location.host, {
        query: { channelid: channel.id, channels_recv_all: settings.channels_recv_all }
    });


    /*
     When connection to backend websocket is established append info message to chat frontend
    */
    socket.on("connect", () => {
        console.log(`Connected to socket with id: ${socket.id}`); // x8WIv7-mJelg7on_ALbx
        let messageobj = {type: 5, initiator:"error", sender_time: Date.now(), name:"Verbunden / Online", text: "Verbunden mit Kanal <b>"+channel.name+"</b> (ID: "+channel.id+")"};
        appendMessage(messageobj);
    });


    /*
     Receiving messages from Webserver and append info message to chat frontend
    */
    socket.on("message", (buffer) => {
        buffer = buffer.trim();
        let messageobj = JSON.parse(buffer);
        messageobj.initiator = "stranger";
        appendMessage(messageobj);
    });


    /*
     Error handling for backend websocket
    */
    socket.on('connect_error', err => handleErrors(err))
    socket.on('connect_failed', err => handleErrors(err))
    socket.on('disconnect', err => handleErrors(err))
    let lasterror = "";
    function handleErrors(err){
        switch(err){
            case "transport close":
                err = "Connection to server lost. Please check Wlan connection.";
                break;
            default:
                err = err.toString();
                break;
        }
        let messageobj = {type: 5, initiator:"error", sender_time: Date.now(), name:"ERROR", text: err};

        /*Ignore error messages if they are the same*/
        if(messageobj.initiator == "error"){
            if(lasterror == messageobj.text)
                return;
            lasterror = messageobj.text;
        }

        appendMessage(messageobj);
    }


    /* The current selected themename */
    let themename = document.getElementById("themesettings").dataset.themename;

    /*
     Load the audios from the theme and adding them to the audios array
    */
    let audios = ["message_send", "notify_in_chat", "error", "random_sound"];
    for (let audioname of audios){
        let audio = new Audio("/themes/"+themename+"/audio/"+audioname+".mp3");
        audios[audioname] = audio;
        audio.addEventListener('error', function(e, audioname) {
            var noSourcesLoaded = (this.networkState===HTMLMediaElement.NETWORK_NO_SOURCE);
            if(noSourcesLoaded) {
                //Theme doesnt include a audio file don't play any audio:
                audios[audioname] = new Audio();
            }
        }, true);
    }

    let chat_form = document.getElementById("chat_form");
    let textarea_message = document.getElementById("textarea_message");


    /*
     Add input event to all textareas in tx array and once trigger an input for height init
    */
    let tx = [textarea_message];
    for (let i = 0; i < tx.length; i++) {
        tx[i].setAttribute("style", "height:" + (tx[i].scrollHeight) + "px;overflow-y:hidden;");
        tx[i].addEventListener("input", texareaChangeSizeOnInput, false);
        tx[i].dispatchEvent(new Event("input"))
    }

    /*
     Auto resize textarea to maximum 150px
    */
    function texareaChangeSizeOnInput() {
        let maxheight = 150;
        this.style.height = 0;
        let newheight = this.scrollHeight < maxheight ? this.scrollHeight : maxheight;
        if(newheight == maxheight){
            this.style.overflowY = "scroll";
        } else {
            this.style.overflowY = "hidden";
        }
        this.style.height = newheight + "px";
        this.scrollTop = this.scrollHeight;
    }

    /*
     Check for keye key events in the chat form
     Submit form when pressing enter
    */
    chat_form.addEventListener('keydown', function (e) {
        /*Only send form when on enter when in textarea*/
        if (e.key === 'Enter' && e.target !== textarea_message) {
            e.preventDefault();  
        }

        /*Enter message on enter button in textarea, Dont submit when shift is pressed */
        if (e.key == 'Enter' && !e.shiftKey && e.target === textarea_message) {
            e.preventDefault();
            submit_form()
        }
    });

    /* 
     Service form: Hide the chat form if service form is present
     Check for existance because it does not exist on all pages
    */
    let service_form = document.querySelector("#service_form");
    if(service_form){
        chat_form.style.display = "none";
        service_form.addEventListener("submit", function(event) {
            event.preventDefault();
            submit_service_form();
        }, true);
    }

    /* 
     Service form submit handling
    */
    function submit_service_form(){

        /*Parse form data to a string*/
        let formdata = new FormData(service_form);
        let formvalues = {location: "Standort", description: "Beschreibung", type: "Typ", persons: "Personen"};
        let messageobj = {type:3, initiator:"self", receiver_address: channel.id, sender_time: Date.now(), name:settings.username};

        let formattedmessage = "";
        for (const [key, value] of Object.entries(formvalues)) {
            if(formdata.get(key).trim()) {
                formattedmessage += "<b>"+value+"</b>: "+formdata.get(key).trim()+"<br>";
                //messageobj[key] = formdata.get(key).trim();
            }
        }

        //Remove last <br> from message
        formattedmessage = formattedmessage.replace(/<br>$/, '');

        if(formattedmessage.trim() != ""){
            /*First send message to LoRa*/
            //messageobj.text = "";
            messageobj.text = formattedmessage;
            send(messageobj);
            console.log(messageobj);

            /*Then append message to chat*/
            messageobj.text = formattedmessage;
            appendMessage(messageobj);
        }

        /*Now hide the form*/
        service_form.style.display = "none";
        chat_form.style.display = "block";
    }


    /*
     Add submit event to the chat form
    */
    chat_form.addEventListener("submit", function(event) {
        event.preventDefault();
        submit_form();
    }, true);

    /*
     Handle the submit of the chat form
    */
    function submit_form(){
        let formdata = new FormData(chat_form);
        let message_content = formdata.get("message").trim();

        /* Ability to send empty messages, replace "" or "Pong!" with "Ping!" */
        if(message_content == "" || message_content == "Pong!") message_content = "Ping!"

        /* Create message object containing essential informations for message
        and userinfo */
        let messageobj = {type:3, initiator:"self", receiver_address: channel.id, sender_time: Date.now(), name:settings.username, text: message_content};


        appendMessage(messageobj);
        send(messageobj);

        /*Set value to nothing and call input event so it can resize again*/
        textarea_message.value = "";
        textarea_message.dispatchEvent(new Event('input', {bubbles: true,cancelable: true,}));
    }


    let chat_messages = document.getElementById("chat_messages");
    /*
     Append a message to the chat frontend
     Play sounds
     Scroll to new message
    */
    function appendMessage(messageobj){

        /*Format time to HH:mm*/
        let time = new Date(parseInt(messageobj.sender_time));
        time = `${('0'+time.getHours()).slice(-2)}:${('0'+time.getMinutes()).slice(-2)}`;

        /*Play sound*/
        let urlParams = new URLSearchParams(window.location.search);

        if(!settings.sound){
            if(messageobj.initiator == "self")
                audios["message_send"].play();
            if(messageobj.initiator == "stranger")
                audios["notify_in_chat"].play();
            if(messageobj.type == 5)
                audios["error"].play();

            /*Random sound just for fun*/
            if(Math.random() < 0.1){
                audios["random_sound"].play();
            }
        }

        /*Scroll to bottom if new message got Appended.
        If user is scrolled 0 to 20 pixels at bottom, it will scroll automatically.
        If not, it wont scroll, e.g. if user is reading old message*/
        let scroll = false
        if(chat_messages.scrollHeight < (chat_messages.scrollTop+chat_messages.offsetHeight+20))
            scroll = true;

        /*Insert the message in the DOM*/
        let htmlmessage = `<div class="${messageobj.initiator}"><span class="name">${messageobj.name}</span><span class="text">${messageobj.text}</span><span class="time">${time}</span> <!--<span class="status">pending...</span>--></div>`;
        chat_messages.insertAdjacentHTML('beforeend', htmlmessage);

        /*After inserting, scroll to bottom if check at top was successful*/
        if(scroll) chat_messages.scrollTop = chat_messages.scrollHeight;
    }


    /* 
     Send messageobj to backend with sockets
    */
    function send(messageobj){
        //Clone object
        let buffer = Object.assign({}, messageobj);

        /*Send files to Webserver*/
        socket.emit("message", buffer, (response) => {
            //console.log(response);
        });
    }

/*End of document ready*/
});