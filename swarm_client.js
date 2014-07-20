var net = require('net');
var fs = require('fs');
var raf = require('random-access-file');

Offset = function(value, size, port) {
  this.value = parseInt(value);
  this.size = parseInt(size);
  this.port = parseInt(port);
}

var f = raf('/tmp/docker3.pkg');

var hosts = [{'host':"192.168.0.110",
              'port':6666,
              'offset':0},
            {'host':"192.168.0.110",
              'port':6667,
              'offset':35344658},
            {'host':"192.168.0.110",
              'port':6668,
              'offset':70689316},
            {'host':"192.168.0.110",
              'port':6669,
              'offset':106033974}]

hosts.forEach(function(h){
  var client = net.connect(h, function(){
    console.log('Connected to host',h.host,'on port',h.port)
  });

  var localoffset = h.offset
  client.on('data', function(data){
    f.write(localoffset, data, function(err, bytes){
      if(err) console.log('error from port', h.port)
      console.log('received',bytes,'from port',h.port);
    });
    localoffset+=data.length
  });
  
  client.on('end', function(){
    console.log('connection to port',h.port,'has ended');
  });
})
