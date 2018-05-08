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
        this.initGame();
        this.initWebsockets();
        this.gameloop = setInterval(() => {
            this.game.update.bind(this.game)();
            if(this.game.spawn_cooldown <= 1)
                this.wss.clients.forEach(this.sendFullGamestate, this);
        }, this.game.config.tick_rate);
    };

    initGame(){
        console.log("Initializing server game instance");

        let game = this.game = new Game();
        //this.game.procgen();

        let src = new Node(5, 5, true);
            src.id = game.nodes.length;
            game.nodes.push(src);
    
            let dest = new Node(5, 9, false);
            dest.id = game.nodes.length;
            game.nodes.push(dest);
    
            let dest2 = new Node(9, 9, false);
            dest2.id = game.nodes.length;
            game.nodes.push(dest2);
    
            src.edges.push(new Edge(0,1));
            dest.edges.push(new Edge(1, 2));
    
            game.printmap();
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
        console.log("Sending full gamestate...");
        ws.send(JSON.stringify(this.game));
    }

    sendLightGamestate(ws){
        console.log("Sending light gamestate...");
        console.error("Not yet implemented");
        //ws.send(JSON.stringify(game));
    }

    handleClientMsg(data, ws){
        console.log("Received ", data);
    }
}

new Server();