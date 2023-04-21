const mysql = require('mysql');
const zmq = require('zeromq');

// connection to database
var con = mysql.createConnection({
  host: "localhost",
  user: "admin",
  password: "password",
  database: "main"
});

// delete tables (if they exist) and then initialize them
function resetTables() 
{
  return new Promise((resolve) => {
    con.connect(function(err) 
    {
      if (err) throw err;
      // now connected to database
    
      // rebuild routing table
      var sql = "DROP TABLE IF EXISTS routing";
      con.query(sql, function (err, result) {
        if (err) throw err;
      });
      var sql = "CREATE TABLE routing (sender_address INT(255), path VARCHAR(255))";
      con.query(sql, function (err, result) {
        if (err) throw err;
        console.log("Table 'routing' resetted");
      });

      // rebuild message table
      var sql = "DROP TABLE IF EXISTS message";
      con.query(sql, function (err, result) {
        if (err) throw err;
      });
      var sql = "CREATE TABLE message (id INT AUTO_INCREMENT PRIMARY KEY, sender_address INT(255), "
               +"receiver_address INT(255), path VARCHAR(255), send_to_path VARCHAR(255), sender_time BIGINT(255), "
               +"location VARCHAR(255), name VARCHAR(255), end_receiver_address INT(255), text VARCHAR(255))";
      con.query(sql, function (err, result) {
        if (err) throw err;
        console.log("Table 'message' resetted");

        // important: if you want to add tables to the database here, 
        // resolve() needs to be called in the last table query like it is done
        // here.
        resolve();

      });

    });
  });
}

// insert received data into database
async function insertIntoDatabase(table, receivedObj, broadcast) 
{
  // current (sender_address, path)-pair object
  outputObjRouting = await queryBySenderAddress("routing", receivedObj.sender_address);

  return new Promise((resolve) => {
    con.connect(function(err) 
    {
      // ROUTING TABLE

      if (broadcast)
      {

        if (outputObjRouting) 
        // only execute if a (sender_address, path)-pair already exists in db
        {
          console.log("current associated path: "+outputObjRouting.path);
          let arrayOldPath = outputObjRouting.path.split(',');
          let arrayNewPath = receivedObj.path.split(',');

          if (arrayNewPath.length < arrayOldPath.length)
          {
            // remove previous path associated with sender_address
            var sql = "DELETE FROM routing WHERE sender_address='"+receivedObj.sender_address+"'";
            con.query(sql, function (err) {
              if (err) throw err;
            });

            // insert new path into routing table
            var insertQuery = "INSERT INTO routing (sender_address, path) VALUES (?, ?)";
            var insertArray = [receivedObj.sender_address, receivedObj.path];

            con.query(insertQuery, insertArray, function (err) {
              if (err) throw err;
            });
          };
          // else: do nothing, leave old pair in db
        }
        else
        // no (sender_address, path)-pair in db yet
        {
          // insert first (sender_address, path)-pair into routing table
          var insertQuery = "INSERT INTO routing (sender_address, path) VALUES (?, ?)";
          var insertArray = [receivedObj.sender_address, receivedObj.path];

          con.query(insertQuery, insertArray, function (err) {
            if (err) throw err;
          });
        };
      }

      // OTHER TABLES

      // insert into other tables.
      // written as a switch-statement, so this can be easily extended with new additional tables 
      switch (table) 
      {
        case "message":

          var insertQuery = "INSERT INTO message (sender_address, receiver_address, path, send_to_path, "
                           +"sender_time, location, name, end_receiver_address, text) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)";
          var insertArray = [receivedObj.sender_address, receivedObj.receiver_address, receivedObj.path, 
                             receivedObj.send_to_path, receivedObj.sender_time, receivedObj.location, receivedObj.name, 
                             receivedObj.end_receiver_address, receivedObj.text];
          break;
      }

      con.query(insertQuery, insertArray, function (err, result) 
      {
        if (err) throw err;
        currentId = result.insertId;
        resolve(currentId);
      });

    });
  });
}

// query a row by id
async function queryById(table, messageId) 
{
  return new Promise((resolve) => {
    con.connect(function(err) 
    {
      var outputQuery = "SELECT * FROM "+table+" WHERE id = (?)";
      con.query(outputQuery, [messageId], function (err, result, fields) 
      {
        if (err) throw err;

	console.log("DATABASE QUERY:")
        console.log(result);
        
        resolve(result[0]);
      });
    });
  });
}

// query by sender_address
async function queryBySenderAddress(table, senderAddress) 
{
  return new Promise((resolve) => {
    con.connect(function(err) 
    {
      var outputQuery = "SELECT * FROM "+table+" WHERE sender_address = (?)";
      con.query(outputQuery, [senderAddress], function (err, result, fields) 
      {
        if (err) throw err;
        console.log(result);
        
        resolve(result[0]);
      });
    });
  });
}

// zmq server; accept messages
async function zmqServer() 
{
  const sock = new zmq.Reply();

  await sock.bind('tcp://*:5555');
  console.log("ZMQ server started");

  for await (const [msg] of sock) 
  {
    let receivedObj = JSON.parse(msg.toString() );

    console.log("RECEIVED OBJECT:")
    console.log(receivedObj);

    if (!receivedObj.path) 
    // path undefined => request; answer with correct path
    {
      outputObj = await queryBySenderAddress("routing", receivedObj.sender_address);

      if (!outputObj) 
      // outputObj undefined => no corresponding routing data in db yet
      {
        await sock.send("No corresponding data in databank yet. Do broadcast first.");
      } 
      else 
      {
	let reply = '{ "path": "'+outputObj.path+'" }'
	console.log("REPLY: "+reply)
        await sock.send(reply);
      }

    } 
    else 
    // data received; let broker handle database insertion
    {
        await broker(receivedObj);
        await sock.send("received");
    }
  }
}

// broker
async function broker(receivedObj) 
{
  // new types for different database tables can be easily added
  switch (receivedObj.type) 
  {
    // broadcast
    case 1:
      var broadcast = true;
      var table = "message";
      break;

    // normal chatmessage
    case 3:
      var broadcast = false;
      var table = "message";
      break;
  }

  // insert new data into database
  currentId = await insertIntoDatabase(table, receivedObj, broadcast);

  // output new entry to terminal
  outputObj = await queryById(table, currentId);
}




async function main() 
{
  // initialize stuff
  await resetTables();
  zmqServer();
}

main();
