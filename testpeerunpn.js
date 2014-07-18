var os = require('os');
var ssdp = require("peer-ssdp");
var SERVER = os.type() + "/" + os.release() + " UPnP/1.1 quantic/0.0.1";
var uuid = "quantic-peer";
var peer = ssdp.createPeer();


var onReady = function () {
    console.log("search for rootdevices");
    peer.search({
        ST: "upnp:rootdevice"
    });
};


peer.on("notify", function (headers, address) {
    console.log("receive notify message from ", address);
    console.log(headers);
    console.log("=======================");
}).on("search", function (headers, address) {
    console.log("receive search request message from ", address);
    console.log(headers);
    console.log("=======================");
    var ST = headers.ST;
    var headers = {
        LOCATION: "http://0.0.0.0/upnp/devices/6bd5eabd-b7c8-4f7b-ae6c-a30ccdeb5988/desc.xml",
        SERVER: SERVER,
        ST: "upnp:rootdevice",
        USN: "uuid:" + uuid + "::upnp:rootdevice",
            'BOOTID.UPNP.ORG': 1
    };
    console.log("send reply to search request from ", address);
    console.log(headers);
    console.log("=======================");
    peer.reply(headers, address);
}).on("found", function (headers, address) {
    console.log("receive found message from ", address);
    console.log(headers);
    console.log("=======================");
}).on("close", function () {
    console.log("close");
}).start();


peer.on("ready", function () {
    console.log("ready");
    onReady();
}).start()

