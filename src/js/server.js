const WS = require('ws'),
    https = require('https'),
    fs = require('fs'),
    _game = require('./game'),
    Game = _game.Game,
    Node = _game.Node,
    Edge = _game.Edge,
    Bubble = _game.Bubble;

class Server{
    constructor(port=8081){
        this.port = port;
        console.log("Starting server");
        //this.initGame();
        this.initWebsockets();

    };

    initGame(){
        console.log("Initializing server game instance");

        let game = this.game = new Game();
        this.game.procgen();

        // let src = new Node(5, 5, true);
        //     src.id = game.nodes.length;
        //     //src.owner = "excalo";
        //     game.nodes.push(src);
    
        //     let dest = new Node(5, 15, false);
        //     dest.id = game.nodes.length;
        //     //dest.owner = "excalo";
        //     game.nodes.push(dest);
    
        //     let dest2 = new Node(15, 15, false);
        //     dest2.id = game.nodes.length;
        //     //dest2.owner = "excalo";
        //     game.nodes.push(dest2);

        this.startGameLoop();
    }

    startGameLoop(){
        this.gameloop = setInterval(() => {
            this.game.update.bind(this.game)();
            if(this.game.spawn_cooldown <= 1){
                let serialized = this.serialize(this.game);
                this.wss.clients.forEach(client => client.send(serialized));
            }
        }, this.game.config.tick_rate);
    }

    initWebsockets(){
        console.log("Initializing websockets");

        let server = this.server = new https.createServer({
            // cert: fs.readFileSync('cert/cert-local.pem'),
            // key: fs.readFileSync('cert/key-local.pem')
            cert: fs.readFileSync('cert/fullchain.pem'),
            key: fs.readFileSync('cert/privkey.pem')
          });
        let wss = this.wss = new WS.Server({ server });
        server.listen(this.port);
        
        wss.on('open', ()=>console.log(`Websocket server running on port ${this.port}`));

        wss.on('connection', ws => {
            console.log("Client connected.");
            ws.on('message', data => this.handleClientMsg(data, ws));
            ws.on('close', () => {
                console.log(`Client ${ws.username} disconnected`);
                this.game.removePlayer(ws.username);
                // TODO pongs with timeout to detect broken connections
            });
            this.sendFullGamestate(ws);
        });
    }

    sendFullGamestate(ws){
        // console.log("Sending full gamestate...");
        this.send(ws, this.game);
    }

    sendLightGamestate(ws){
        // console.log("Sending light gamestate...");
        console.error("Not yet implemented");
        // ws.send(this.serialize(this.game));
    }

    getSpawn(){
        const SPAWN_POSSIBILITIES = 5;
        let center = {x: this.game.config.width / 2, y: this.game.config.height / 2};
        let centerNodes = [];
        this.game.nodes.filter(node => node.isSource && node.owner === 'server').forEach(node => {
            let dist = this.game.distance(center, node);
            for(var i = 0; i < centerNodes.length; i++){
                if(centerNodes[i].dist > dist){
                    centerNodes.splice(i, 0, {node:node, dist:dist});
                    if(centerNodes.length > SPAWN_POSSIBILITIES)
                        centerNodes.splice(SPAWN_POSSIBILITIES, centerNodes.length - SPAWN_POSSIBILITIES);
                    break;
                }
            }
        });

        // No available spawns!
        if(centerNodes.length === 0)
            return false;

        return chance.pickone(centerNodes);
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

        handlers.spawnplayer = msg => {
            // Username already taken
            if(this.game.players[msg.username]){
                console.error(`Username ${msg.username} taken`);
                this.send(ws, {msgtype: 'username_taken_error'});
                return;
            }

            // Username too long
            if(msg.username.length > 128){
                console.error(`Username ${msg.username} too long`);
                this.send(ws, {msgtype: 'username_validation_error'});
                return;
            }

            // Validation passed; get spawnpoint
            let spawn = this.game.getSpawn();
            if(!spawn){
                console.error(`Cannot get spawn for username ${msg.username}; server full`);
                this.send(ws, {msgtype: 'server_full_error'});
                return;
            }

            // Successful spawn
            console.log(`Player spawned with username ${msg.username}`);
            this.game.players[msg.username] = { color: msg.color };
            spawn.owner = msg.username;
            ws.username = msg.username;
            this.send(ws, {msgtype: 'spawn_success', username: msg.username, spawn:spawn.id});
        };

        handlers.viewport = msg => {
            ws.viewport = msg;
            ws.lastupdate = new Date();
            //console.log("Nodes in viewport this frame:", this.game.nodes.filter(node => node.x >= ws.viewport.left && node.x <= ws.viewport.right && node.y <= ws.viewport.bottom && node.y >= ws.viewport.top).length);
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

    send(ws, obj){
        if(!ws){
            console.error("Could not send object; no socket specified", obj);
            return false;
        }
        ws.send(this.serialize(obj));
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
server.initGame();
//server.loadTest();
