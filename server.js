const WS = require('ws'),
    _game = require('./game'),
    Game = _game.Game,
    Node = _game.Node,
    Edge = _game.Edge,
    Bubble = _game.Bubble;

class Server{
    constructor(port=9999){
        this.port = port;
        console.log("Starting server");
        //this.initGame();
        this.initWebsockets();

    };

    initGame(){
        console.log("Initializing server game instance");

        let game = this.game = new Game();
        //this.game.procgen();

        let src = new Node(5, 5, false);
            src.id = game.nodes.length;
            src.owner = "excalo";
            game.nodes.push(src);
    
            let dest = new Node(5, 25, false);
            dest.id = game.nodes.length;
            dest.owner = "excalo";
            game.nodes.push(dest);
    
            let dest2 = new Node(30, 25, false);
            dest2.id = game.nodes.length;
            dest2.owner = "excalo";
            game.nodes.push(dest2);

        this.startGameLoop();
    }

    startGameLoop(){
        this.gameloop = setInterval(() => {
            this.game.update.bind(this.game)();
            if(this.game.spawn_cooldown <= 1)
                this.wss.clients.forEach(this.sendFullGamestate, this);
        }, this.game.config.tick_rate);
    }

    initWebsockets(){
        console.log("Initializing websockets");

        let wss = this.wss = new WS.Server({ port: this.port });
        
        // Broadcast to all.
        wss.broadcast = function broadcast(data) {
            wss.clients.forEach(client => {
                if (client.readyState === WebSocket.OPEN)
                    client.send(data);
            });
        };
        
        wss.on('open', ()=>console.log(`Websocket server running on port ${this.port}`));

        wss.on('connection', ws => {
            ws.on('message', data => this.handleClientMsg(data, ws));
        });
    }

    sendFullGamestate(ws){
        // console.log("Sending full gamestate...");
        ws.send(this.serialize(this.game));
    }

    sendLightGamestate(ws){
        // console.log("Sending light gamestate...");
        console.error("Not yet implemented");
        // ws.send(this.serialize(this.game));
    }

    handleClientMsg(data, ws){
        //console.log("Received", data);
        let msg = this.deserialize(data);
        console.log(msg);

        let handlers = {};

        handlers.playerconnect = msg => {
            this.game.players[msg.username] = { color: msg.color };
            ws.username = msg.username;
        };

        handlers.colorchange = msg => this.game.players[ws.username].color = msg.color;
        handlers.createEdge = msg => this.game.createEdge(ws.username, msg.from, msg.to);
        handlers.removeEdge = msg => this.game.removeEdge(ws.username, msg.from, msg.to);

        if(handlers[msg.msgtype] == undefined){
            console.error(`Unrecognized client msgtype ${msg.msgtype}`);
            return;
        }
        handlers[msg.msgtype](msg);
    }

    deserialize(data){
        // TODO: msgpack
        return JSON.parse(data);
    }

    serialize(data){
        // TODO: msgpack
        return JSON.stringify(data);
    }

    loadTest(){
        let game = new Game();
        game.config.width = 1000;
        game.config.height = 1000;
        console.log("Procedurally generating map...");
        let start = new Date().getTime();
        game.procgen();
        console.log(`Procgen took ${new Date().getTime() - start}ms`);
        console.log("Width:", game.config.width);
        console.log("Height:", game.config.height);
        console.log("Nodes:", game.nodes.length);
    
        // Create maximum possible edges: from every node to every other node possible
        console.log("Generating all possible edges");
        game.nodes.forEach(node => {
            node.owner = "excalo";
            game.nodes.forEach(otherNode => {
                game.createEdge("excalo", node.id, otherNode.id);
            });
        });
        let numEdges = game.countEdges();
        console.log("Edges:", numEdges);
        console.log("Avg edges/node", numEdges / game.nodes.length);

        // Game.update
        for(var i = 0; i < 60 * 4; i++){
            console.log(`Update #${i}`);
            let start = new Date().getTime(); // Super rigorous production-quality benchmarking
            game.update(); // Sample size of one because fuck the stats, who cares
            let end = new Date().getTime();
            console.log(`- Update took ${end - start}ms`);
            console.log(`- Bubbles: ${game.countBubbles()}`);
        }
    
        process.exit();
        // server.game = game;
        // server.startGameLoop();
    }
}

let server = new Server();
// server.initGame();
server.loadTest();