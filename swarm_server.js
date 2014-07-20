var net = require('net');
var fs = require('fs');
var raf = require('random-access-file');

Offset = function(value, size, port) {
  this.value = parseInt(value);
  this.size = parseInt(size);
  this.port = parseInt(port);
}

var filepath = '/tmp/docker.pkg';
var start_time = null;
var bytes = 0;

// Splitted approach
var pieces = 4;
var stats = fs.statSync(filepath);
var offsets = [];
var accum = 0;
var port = 6666;
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

console.log(offsets);

offsets.forEach(function(o) {
  serve(o);
});

function serve(offset) {
  var randomFile = raf(filepath);

  randomFile.read(offset.value, offset.size, function(err, chunk) {
    var server = net.createServer(function(socket) {
      console.log("Serving chunk", offset.value);
      if (start_time === null) {
        start_time = Date.now();
      }
      bytes += chunk.length;
      socket.write(chunk);
      //console.log('sendind chunk', offset.value, chunk.length, bytes);
      //console.log('***********************************');
      //console.log(chunk.toString());
      //
      socket.on('end', function() {
        console.log("Closed socket for", offset.port);
      });
    });

    server.listen(offset.port, function() {
      console.log("Listening on port", offset.port);
    });
  });
}
