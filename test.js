var net = require('net');
var fs = require('fs');
var path = require('path');
var raf = require('random-access-file');
var http = require('http');
var url = require('url');

var HEADER_SIZE = 16;
//var MESSAGES_PORT = 6666;
var MESSAGES_PORT = 5000;
var DEFAULT_PORT = 6667;

var bytes = 0;
var filename = '';
var stream = null;
var start_time = null;
var end_time = null;
var buddies = [];

Offset = function(value, size, port) {
  this.value = parseInt(value);
  this.size = parseInt(size);
  this.port = parseInt(port);
}

var bus = http.createServer(function(req, res) {
  var parsedUrl = url.parse(req.url, true);

  if (parsedUrl.pathname === '/initialize') {
    console.log('Initializing');
    var filename = req.headers.filename;
    var filesize = parseInt(req.headers.filesize);
    var chunks = []
    req.headers.chunks.split(",").forEach(function(c) {
      var value = c.split("-")[0];
      var size = c.split("-")[1];
      var port = c.split("-")[2];
      chunks.push(new Offset(value, size, port));
    });
    res.writeHead(200);
    res.end();
    spawnAndReceive(filename, filesize, chunks);
  }
});

function receiveData() {
  bus.listen(MESSAGES_PORT);

  // Sequential approach
  ////var server = net.createServer(function(socket) {
  ////  socket.on('data', function(buf) {
  ////    if (start_time === null) {
  ////      start_time = Date.now();
  ////    }

  ////    bytes += buf.length;
  ////    if (bytes >= HEADER_SIZE && stream === null) {
  ////      var header = buf.slice(0, HEADER_SIZE).toString();
  ////      header = header.replace(/\n/g, "");
  ////      console.log('header: ' + header + '...');
  ////      filename = header.slice(5);
  ////      stream = fs.createWriteStream(filename);
  ////      stream.write(buf.slice(HEADER_SIZE));
  ////      bytes -= HEADER_SIZE;
  ////    } else {
  ////      stream.write(buf);
  ////    }
  ////  });

  ////  socket.on('end', function() {
  ////    stream.end();
  ////    end_time = Date.now();
  ////    var total_time = end_time - start_time;

  ////    console.log('Transfer finished');
  ////    console.log('Received: ' + bytes + ' bytes');
  ////    console.log('Time spent: ' + total_time + 'ms');
  ////    console.log('Rate: ' + ((bytes / 1000) / (total_time / 1000)) + ' KB/sec');
  ////    reset();
  ////  });
  ////});

  //server.listen(DEFAULT_PORT);
}

function spawnAndReceive(filename, filesize, chunks) {
  var randomFile = raf(filename);
  var servers = [];

  chunks.forEach(function(c) {
    var s = net.createServer(function(socket) {
      var startOffset = c.value;
      var currOffset = c.value;
      socket.on('data', function(buf) {
        if (start_time === null) {
          start_time = Date.now();
        }
        randomFile.write(currOffset, buf, function(err, written, b) {
          console.log('chunk', startOffset, currOffset, written, bytes, filesize);
          console.log('***********************************');
          //console.log(b.toString());
          bytes += written;
          currOffset += written;
          if (bytes === filesize) {
            //console.log('servers', servers.length, servers);
            servers.forEach(function(serv) {
              serv.close();
            });

            end_time = Date.now();
            var total_time = end_time - start_time;

            randomFile.close();

            console.log('Transfer finished');
            console.log('Sent: ' + bytes + ' bytes');
            console.log('Time spent: ' + total_time + 'ms');
            console.log('Rate: ' + ((bytes / 1000) / (total_time / 1000)) + ' KB/sec');
          }
        });
      });

      socket.on('end', function() {
        console.log('socket ended');
      });
    });

    s.on('close', function() {
      console.log('server ended');
    });

    servers.push(s);
    s.listen(c.port);
  });
}

function sendData(filepath, host) {
  host = typeof host !== 'undefined' ? host : '127.0.0.1';
  console.log('Sending file', filepath, 'to', host);

  // Splitted approach
  var pieces = 3;
  var stats = fs.statSync(filepath);
  var offsets = [];
  var accum = 0;
  var port = DEFAULT_PORT;
  chunks = []
  for (var i=0; i<pieces; i++) {
    var next = Math.ceil(stats.size / pieces);
    if (accum + next > stats.size)
      next = stats.size - accum;
    offsets.push(new Offset(accum, next, port));
    chunks.push(accum + "-" + next + "-" + port);
    accum += Math.ceil(stats.size / pieces);
    port += 1;
  }

  var req = http.request({
    host: host,
    port: MESSAGES_PORT,
    path: '/initialize',
    headers: {
      'Filename': path.basename(filepath),
      'Filesize': stats.size,
      'Chunks': chunks.join(","),
    }
  }, function(res) {
    console.log('Initialized');
    splitAndSend(filepath, offsets, host);
  });

  req.on('error', function(e) {
    console.log('error initializing', e);
  });
  req.end();

  // Sequential approach
  //var client = net.connect(6666, host, function() {
  //  client.write('SNDF-song.mp3\n\n\n');

  //  stream = fs.createReadStream(filepath);
  //  stream.on('data', function(chunk) {
  //    if (start_time === null) {
  //      start_time = Date.now();
  //    }
  //    bytes += chunk.length;
  //    client.write(chunk);
  //  });

  //  stream.on('end', function() {
  //    client.end();
  //  });
  //});

  //client.on('close', function() {
  //    end_time = Date.now();
  //    var total_time = end_time - start_time;

  //    console.log('Transfer finished');
  //    console.log('Sent: ' + bytes + ' bytes');
  //    console.log('Time spent: ' + total_time + 'ms');
  //    console.log('Rate: ' + ((bytes / 1000) / (total_time / 1000)) + ' KB/sec');
  //    reset();
  //});
}

function splitAndSend(filepath, offsets, host) {
  var clients = [];
  var randomFile = raf(filepath);

  offsets.forEach(function(o) {
    randomFile.read(o.value, o.size, function(err, chunk) {
      var c = net.connect(o.port, host, function() {
        if (start_time === null) {
          start_time = Date.now();
        }
        bytes += chunk.length;
        console.log('sendind chunk', o.value, chunk.length, bytes);
        console.log('***********************************');
        console.log(chunk.toString());
        c.write(chunk);
        c.end();
      });
      c.on('close', function() {
        console.log('socket ended');
        var i = clients.indexOf(c);
        clients.splice(i, 1);
        if (clients.length === 0) {
          console.log('clients', clients.length, clients);
          end_time = Date.now();
          var total_time = end_time - start_time;

          randomFile.close();

          console.log('Transfer finished');
          console.log('Sent: ' + bytes + ' bytes');
          console.log('Time spent: ' + total_time + 'ms');
          console.log('Rate: ' + ((bytes / 1000) / (total_time / 1000)) + ' KB/sec');
        }
      });
      clients.push(c);
    });
  });
}

function listBuddies() {
}

function reset() {
  bytes = 0;
  filename = '';
  stream = null;
  start_time = null;
  end_time = null;
}

function printUsage(errorMessage) {
  if (typeof errorMessage !== 'undefined') {
    console.log('ERROR:', errorMessage);
  }
  console.log('usage: node test.js list');
  console.log('       node test.js receive');
  console.log('       node test.js send <file> [host]');
  process.exit();
}

if (process.argv.length <= 2) {
  printUsage('Missing parameters');
} else {
  var command = process.argv[2];
  var filepath = process.argv[3];
  var host = process.argv[4];

  if (command === 'list') {
    listBuddies();
  } else if (command === 'receive') {
    receiveData();
  } else if (command == 'send') {
    if (typeof filepath === 'undefined') {
      printUsage('Specify a file to send');
    }
    if (typeof host === 'undefined') {
      printUsage('Specify a host to send the file');
    }
    sendData(filepath, host);
  }
}
