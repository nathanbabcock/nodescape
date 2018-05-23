const WebSocket = require('ws');

const ws = new WebSocket('wss://localhost:8081');

ws.on('open', function open() {
    console.log("Connected!");
  ws.send('something');
});

ws.on('message', function incoming(data) {
  console.log("Received", data);
});