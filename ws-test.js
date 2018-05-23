const WebSocket = require('ws');

const ws = new WebSocket('ws://echo.websocket.org');

ws.on('open', function open() {
    console.log("Connected!");
  ws.send('something');
});

ws.on('message', function incoming(data) {
  console.log("Received", data);
});