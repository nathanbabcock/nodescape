const gamestate_cache = 'gamestate.json';

const WS = require('ws'),
    https = require('https'),
    fs = require('fs'),
    _ = require('lodash'),
    APIConnector = require('./api-connector'),
    env = require('./../client/js/environment'),
    _game = require('./../client/js/game'),
    Game = _game.Game,
    Node = _game.Node,
    Edge = _game.Edge,
    Bubble = _game.Bubble;

class Server{
    constructor(port=8081){
        this.port = port;
        console.log(`Starting server (${env})`);
        //this.initGame();
        this.initWebsockets();
        this.APIConnector = new APIConnector();
        this.disconnectedClients = [];
    };

    initGame(){
        console.log("Initializing server game instance");
        this.game = new Game();

        if(!this.load())
            this.game.procgen();

        this.startGameLoop();
    }

    startGameLoop(){
        const CLIENT_TIMEOUT = 5 * 1000;        
        this.gameloop = setInterval(() => {
            try {
                this.game.update.bind(this.game)();
                if(this.game.spawn_cooldown <= 1){
                    this.wss.clients.forEach(this.sendLightGamestate, this);
                    // this.wss.clients.forEach(client => {
                    //     if(new Date().getTime() > client.lastupdate + CLIENT_TIMEOUT){
                    //         console.log(`Client ${client.username} lost connection to the server.`);
                    //         client.close();
                    //     }
                    // });
                    // console.log("Disconnected clients:", this.disconnectedClients.length);
                    // console.log("Players:", Object.keys(this.game.players).length);
                    // this.checkDisconnectedClients();
                    this.save();
                }
            } catch (e) {
                console.error(e);

            }
        }, this.game.config.tick_rate);
    }

    checkDisconnectedClients(){
        const RECONNECT_TIME = 1 * 60 * 1000;
        for(var i = 0; i < this.disconnectedClients.length; i++){
            if(new Date().getTime() > this.disconnectedClients[i].time + RECONNECT_TIME){
                let mClient = this.disconnectedClients[i];
                console.log(`Reconnection window closed for player ${mClient.username}`);
                if(this.game.players[mClient.username] && !this.game.players[mClient.username].permanent){
                    console.log(`Removing non-permanent player ${mClient.username}`);
                    this.game.removePlayer(mClient.username);
                }
                this.disconnectedClients.splice(i, 1);
                --i;
            }
        }
    }

    initWebsockets(){
        console.log("Initializing websockets");

        // Environment
        let options;
        if(env === 'production'){
            options = {
                cert: fs.readFileSync('cert/fullchain.pem'),
                key: fs.readFileSync('cert/privkey.pem')
            }
        } else {
            options = {
                cert: fs.readFileSync('cert/cert-local.pem'),
                key: fs.readFileSync('cert/key-local.pem')
            }
        }

        let server = this.server = new https.createServer(options);
        let wss = this.wss = new WS.Server({ server });
        server.listen(this.port);
        
        wss.on('open', ()=>console.log(`Websocket server running on port ${this.port}`));

        wss.on('connection', ws => {
            console.log("Client connected.");
            ws.on('message', data => {
                try {
                    return this.handleClientMsg(data, ws);
                } catch (e) {
                    console.error(e);
                }
            });
            ws.on('close', () => {
                if(!ws.username)
                    return;
                console.log(`Client ${ws.username} disconnected`);
                if(this.game.players[ws.username] && !this.game.players[ws.username].permanent){
                    console.log(`Removing non-permanent player ${ws.username}`);
                    this.game.removePlayer(ws.username);
                }
                // console.log(`Client ${ws.username} disconnected (start of reconnection window)`);
                // this.disconnectedClients.push({username:ws.username, time: new Date().getTime()});
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
        if(!ws.viewport)
            return this.sendFullGamestate(ws);

        let gamestate = {
            spawn_cooldown: this.game.spawn_cooldown,
            players: this.game.players, // TODO could optimize this array too
            nodes: {} // send as obj instead of array since it's gonna be sparse
        };

        let padding = this.game.config.max_edge;
        for(var i = 0; i < this.game.nodes.length; i++){
            let node = this.game.nodes[i];
            if(node.x < ws.viewport.left - padding || node.x > ws.viewport.right + padding || node.y < ws.viewport.top - padding || node.y > ws.viewport.bottom + padding)
                continue;
            gamestate.nodes[i] = node;
        }

        this.send(ws, gamestate);

        // console.log("Sending light gamestate...");
        // console.error("Not yet implemented");
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

    validateUsername(username){
        // Username already taken
        if(this.game.players[username])
            return `Username taken`;

        // Username too short
        if(username.length < 1)
            return `Username too short`;

        // Username too long
        if(username.length > 32)
            return `Username too long`;

        return true;
    }

    handleClientMsg(data, ws){
        //console.log("Received", data);
        let msg = this.deserialize(data);
        // console.log(msg);

        let handlers = {};

        handlers.playerconnect = msg => {
            this.game.players[msg.username] = { color: msg.color };
            ws.username = msg.username;
        };

        handlers.spawnplayer = msg => {
            let valid = this.validateUsername(msg.username);
            if(valid !== true) {
                console.error(valid);
                this.send(ws, {msgtype: 'spawn_failed', error: valid});
                return;
            }
            
            // Validation passed; get spawnpoint
            let spawn = this.game.getSpawn();
            if(!spawn){
                let error = `Cannot get spawn for username ${msg.username}; server full`;
                console.error(error);
                this.send(ws, {msgtype: 'spawn_failed', error});
                return;
            }

            // Successful spawn
            console.log(`Player spawned with username ${msg.username}`);
            this.game.players[msg.username] = { color: msg.color };
            spawn.owner = msg.username;
            ws.username = msg.username;
            this.send(ws, {msgtype: 'spawn_success', username: msg.username, spawn:spawn.id, color:msg.color});
        };

        handlers.viewport = msg => {
            ws.viewport = msg;
            ws.lastupdate = new Date().getTime();
            //console.log("Nodes in viewport this frame:", this.game.nodes.filter(node => node.x >= ws.viewport.left && node.x <= ws.viewport.right && node.y <= ws.viewport.bottom && node.y >= ws.viewport.top).length);
        };

        handlers.registerPermanent = msg => {
            console.log("Registering a player as permanent");
            this.APIConnector.auth0RegisterPlayer(msg.id_token, ws.username)
                .then(() => this.APIConnector.stripeExecutePayment(msg.stripe_token))
                .then(() => {
                    this.game.players[ws.username].permanent = true;
                    this.send(ws, {msgtype: 'register_success'});
                })
                .catch(err => {
                    console.error(err);
                    this.send(ws, {msgtype: 'register_failed'});
                });
        }

        handlers.login = msg => {
            console.log("Logging in player");
            this.APIConnector.auth0Login(msg.id_token)
                .then(player_name => {
                    ws.username = player_name;


                    let origin = null,
                        respawned = false;
                    // TODO check for existence of player instance in game list of players
                    if(!this.game.players[player_name]){
                        this.game.players[player_name] = {color:0x0}; // TODO get random color
                        origin = this.game.getSpawn();
                        origin.owner = player_name;
                        // TODO alert user that they have been respawned?
                    }

                    // TODO find and return id of a node owned by the player (or maybe their largest node)
                    if(origin === null){
                        let network = this.game.nodes.filter(node => node.owner === player_name);
                        if(network.length > 0)
                            origin = network.sort((x, y) => x.value - y.value)[0];
                    }

                    // TODO if no such node exists, spawn new one
                    if(origin === null){
                        origin = this.game.getSpawn();
                        origin.owner = player_name;
                    }

                    ws.username = player_name;
                    this.send(ws, {msgtype: 'login_success', username:player_name, origin:origin.id, respawned, color:this.game.players[player_name].color});
                })
                .catch(err => {
                    console.error(err);
                    this.send(ws, {msgtype: 'login_failed'});
                })
        }

        handlers.changeColor = msg => {
            console.log(`Changing color for user ${ws.username} (color=${msg.color.toString(16)})`);

            // Failed
            if(!ws.username){
                let error='User not spawned yet';
                console.error(error);
                return this.send(ws, {
                    msgtype:'changeColor_failed',
                    error
                });
            }

            // Success
            this.game.players[ws.username].color = msg.color;
            this.send(ws, {
                msgtype:'changeColor_success',
                color:msg.color
            });
        };

        handlers.changeName = msg => {
            console.log(`Changing username for player ${ws.username} to ${msg.username}`);

            // Not spawned yet
            if(!ws.username){
                let error='User not spawned yet';
                console.error(error);
                return this.send(ws, {
                    msgtype:'changeName_failed',
                    error,
                    username:ws.username
                });
            }

            // Validation
            let valid = true;
            if(msg.username !== ws.username)
                valid = this.validateUsername(msg.username);
            if(valid !== true){
                console.error(valid);
                return this.send(ws, {msgtype: 'changeName_failed', error: valid, username: ws.username});
            }

            if(this.game.changeName(ws.username, msg.username)){
                ws.username = msg.username;
                this.send(ws, {
                    msgtype:'changeName_success',
                    username:msg.username
                });
            } else
                return this.send(ws, {msgtype: 'changeName_failed', error: 'Unknown error', username: ws.username});
            
        };

        handlers.createEdge = msg => this.game.createEdge(ws.username, msg.from, msg.to);
        handlers.removeEdge = msg => this.game.removeEdge(ws.username, msg.from, msg.to);

        handlers.reconnect = msg => {
            // Handle broken sockets that didn't disconnect
            let oldsocket = undefined;
            this.wss.clients.forEach(ws => {
                if(ws.username === msg.username){
                    oldsocket = ws;
                }
            })
            if(oldsocket !== undefined) {
                console.log(`Found broken websocket for user ${oldsocket.username}`);
                oldsocket.close();
            } else {
                // Check list of disconnected clients
                let index = this.disconnectedClients.findIndex(client => client.username === msg.username);
                if(index === -1) {
                    console.error(`Refusing reconnection from client ${msg.username}; not found or outside reconnection window`);
                    ws.close();
                    return;
                }
                this.disconnectedClients.splice(index, 1);
            }

            console.log(`Accepted reconnection from user ${msg.username}`);
            ws.username = msg.username;
            // TODO send success msg?
        }

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
        } else if (ws.readyState >= 2){
            console.error(`Socket for user ${ws.username} in readyState ${ws.readyState}; closing socket`);
            ws.terminate();
            return false;
        }
        ws.send(this.serialize(obj));
    }

    save(){
        fs.writeFileSync(gamestate_cache, this.serialize(this.game));
        return true;
    }

    load(){
        console.log("Loading gamestate from disk...");
        if(fs.existsSync(gamestate_cache)){
            if(!this.game) this.game = new Game();
            let savedGame = this.deserialize(fs.readFileSync(gamestate_cache));
            _.merge(this.game, savedGame);

            // Remove non-permanent players
            for (var player in this.game.players) {
                if (this.game.players.hasOwnProperty(player) && !this.game.players[player].permanent) {
                    this.game.removePlayer(player);
                    console.log(`Removed non-permanent player ${player}`);
                }
            }

            console.log("Gamestate loaded.");
            return true;
        }
        console.log("No saved gamestate found.");
        return false;
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
