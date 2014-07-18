var net = require('net');
var fs = require('fs');
var ssdp = require('upnp-ssdp');

var HEADER_SIZE = 16;

var bytes = 0;
var filename = '';
var stream = null;
var start_time = null;
var end_time = null;
var buddies = [];

var upnpClient = new ssdp();
var upnpServer = new ssdp();
//var units = ['TB', 'GB', 'MB', 'KB', 'Bytes']

//function humanizeSize(size) {
//  var index = 0;
//  var power = 12;
//
//  while true {
//    var c = size / Math.pow(10, power);
//    console.log(c);
//    if (c > 0) {
//      power -= 3;
//      index += 1;
//    } else {
//      break;
//    }
//  }
//  return (size / Math.pow(10, power)) + " " + units[index];
//}

function receiveData() {
  var server = net.createServer(function(socket) {
    socket.on('data', function(buf) {
      if (start_time === null) {
        start_time = Date.now();
      }

      bytes += buf.length;
      if (bytes >= HEADER_SIZE && stream === null) {
        var header = buf.slice(0, HEADER_SIZE).toString();
        header = header.replace(/\n/g, "");
        console.log('header: ' + header + '...');
        filename = header.slice(5);
        stream = fs.createWriteStream(filename);
        stream.write(buf.slice(HEADER_SIZE));
        bytes -= HEADER_SIZE;
      } else {
        stream.write(buf);
      }
    });

    socket.on('end', function() {
      stream.end();
      end_time = Date.now();
      var total_time = end_time - start_time;

      console.log('Transfer finished');
      console.log('Received: ' + bytes + ' bytes');
      console.log('Time spent: ' + total_time + 'ms');
      console.log('Rate: ' + ((bytes / 1000) / (total_time / 1000)) + ' KB/sec');
      reset();
    });
  });

  upnpServer.announce({name:'192.168.0.101', port:6666});
  server.listen(6666);
}

function sendData(filepath, host) {
  host = typeof host !== 'undefined' ? host : '127.0.0.1';
  //var client = net.connect(6666, '192.168.0.101', function() {
  var client = net.connect(6666, host, function() {
    console.log('Sending file ' + filepath);
    client.write('SNDF-song.mp3\n\n\n');

    stream = fs.createReadStream(filepath);
    stream.on('data', function(chunk) {
      if (start_time === null) {
        start_time = Date.now();
      }
      bytes += chunk.length;
      client.write(chunk);
    });

    stream.on('end', function() {
      client.end();
    });
  });

  client.on('close', function() {
      end_time = Date.now();
      var total_time = end_time - start_time;

      console.log('Transfer finished');
      console.log('Sent: ' + bytes + ' bytes');
      console.log('Time spent: ' + total_time + 'ms');
      console.log('Rate: ' + ((bytes / 1000) / (total_time / 1000)) + ' KB/sec');
      reset();
  });
}

function listBuddies() {
  upnpClient.search('239.255.255.250');
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

upnpClient.on('up', function(address) {
  console.log('buddy added', address, 'chao');
});

upnpClient.on('down', function(address) {
  console.log('buddy removed', address, 'goodbye');
});

if (process.argv.length <= 2) {
  printUsage('Missing parameters');
} else {
  var command = process.argv[2];
  var path = process.argv[3];
  var host = process.argv[4];

  if (command === 'list') {
    listBuddies();
  } else if (command === 'receive') {
    receiveData();
  } else if (command == 'send') {
    if (typeof path === 'undefined') {
      printUsage('Specify a file to send');
    }
    if (typeof host === 'undefined') {
      printUsage('Specify a host to send the file');
    }
    sendData(path, host);
  }
}
