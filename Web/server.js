/*
 This is the main file of the webserver backend.
 It provides a chat UI and exchanges messages with a LoRa python program.
*/

//Use strict to repair weird javascript characteristics
"use strict";

/*
 Show all errors in console and prevent crashing if anything goes bad
*/
process.on('uncaughtException', function (exception) {
   console.log(exception);
});

/*
 Include and init all important modules
*/

var express = require('express');
var bodyparser = require('body-parser');
var cookieParser = require('cookie-parser');
var fs = require('fs');

var app = express();
var server = require('http').createServer(app);
// sudo iptables -t nat -A PREROUTING -p tcp --dport 80 -j REDIRECT --to-ports 8081
var port = 8081;
server.listen(port, function () {
   console.log("App started on localhost:%s", port)
});

app.use(bodyparser.json()); //Bodyparser: To get http POST data
app.use(bodyparser.urlencoded({ extended: true }));
app.use(cookieParser()); //Cookieparser: To work with cookies
app.use(express.static(__dirname + '/public'));
app.set('views', __dirname + '/views/pages');
app.set('view engine','ejs'); //Embedded JavaScript templates (EJS)
app.engine('html', require('ejs').renderFile);

/*Include and start sockets for connection between Frontend and LoRa*/
require("./sockets_lora.js").start_sockets(server);

// Default page attributes
var page = {title: "LoRa Emergency", subtitle: "Im Rahmen eines Teamprojekts and der Universität Paderborn"}


/* Read channels.json and (in future) more data to data array for usage later */
var data = [];
data["channels"] = require('./data/channels.json');


/*
 Themes:
 Read all the themes and read theme.json file to it
 All themes will be accible through themes variable
*/
var themes_list = fs.readdirSync("./public/themes", { withFileTypes: true })
.filter(dirent => dirent.isDirectory()).map(dirent => dirent.name);
var themes = [];
let defaulttheme = "0-default";
for(let theme of themes_list){
   themes[theme] = require('./public/themes/'+theme+"/theme.json");
   themes[theme].key = theme;
}


/*
 ROUTER: Settings page on POST Request: Form handling
*/
app.post('/settings', function (req, res) {

   /*Form validation*/
   let errormsg = "";
   if(!req.body.username || req.body.username.length < 3){
      errormsg = "Name is to short! (<3 characters)";
   }

   /*Change darkmode setting from off/on to a boolean*/
   req.body.darkmode = req.body.darkmode == "on";
   req.body.sound = req.body.sound == "on";
   req.body.channels_recv_all = req.body.channels_recv_all == "on";

   if(errormsg != ""){
      /*Form validation not successful, render settings template with an error message*/
      res.render('settings.ejs', {
         page: page,
         error: {
            msg:errormsg
         },
         themes: themes,
         settings: get_settings(req)
      });
   } else {
      /*
       Form validation successful:
       1. store settings
       2. redirect to chat
      */
      res.cookie('username',req.body.username);
      res.cookie('theme',req.body.theme);
      res.cookie('darkmode',req.body.darkmode);
      res.cookie('sound',req.body.sound);
      res.cookie('channels_recv_all',req.body.channels_recv_all);

      res.redirect('/chat');
   }
});


/*
 ROUTER: Settings page on GET Request, renders settings template
*/
app.get('/settings', function (req, res) {

   res.render('settings.ejs', {
      page: page,
      themes: themes,
      settings: get_settings(req),
   });

})


/*
 ROUTER: If the user visited the website the first time and does not have cookies set redirect to settings
*/
app.use(function(req, res, next) {
   if (first_visit(req,res)){
      return res.redirect('/settings');
   } else{
      next();
   }
});


/*
 ROUTER: Show map page
*/
app.get('/map', function (req, res) {
   res.render('map.ejs', {
      page: page,
      channels: data["channels"],
      settings: get_settings(req)
    });
})


/*
 ROUTER: Channels overview, renders start template
*/
app.get('/chat', function (req, res) {
   res.render('start.ejs', {
      page: page,
      channels: data["channels"],
      settings: get_settings(req)
    });
})


/*
 ROUTER: Single Channel view / Chat fields, renders chat template
*/
app.get('/chat/:id', function (req, res) {
   var channel = data["channels"].find(x => x.id == req.params.id);
   if(channel){
      res.render('chat.ejs', {
         page: page,
         channel: channel,
         settings: get_settings(req)
       });
   } else {
      res.send('Error. The channel could not be found. Please');
   }
})


/*
 ROUTER: Root path / of website, redirect to /chat
*/
app.get('/', function (req, res) {
   res.redirect('/chat');
});


/*
 ROUTER: 404 redirect to /
*/
app.get('*', function(req, res){
   res.redirect('/');
});


/*
 Boolean: If its the first visit or not
*/
function first_visit(req,res){
   return typeof req.cookies['username'] == 'undefined';
}

/*
 Returns all the settings stored in cookies
*/
function get_settings(req){
   return {
      theme: req.cookies['theme'] ?? defaulttheme,
      username: req.cookies['username'],
      darkmode: req.cookies['darkmode'] == "true",
      sound: req.cookies['sound'] == "true",
      channels_recv_all: req.cookies['channels_recv_all'] == "true"
   }
}