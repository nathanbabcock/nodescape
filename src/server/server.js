const
    gamestate_cache = 'gamestate.json',
    client_cache = 'client_cache.json';

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
        this.clients = {};
    }

    generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

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
                    this.checkClients();
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

    checkClients(){
        const
            CONNECTION_TIMEOUT = 5 * 1000,
            RECONNECT_TIMEOUT = 1 * 60 * 1000;
        for(var uuid in this.clients){
            let client = this.clients[uuid];
            // console.log(`Time is ${new Date().getTime()} vs timeout of ${client.lastUpdate + CONNECTION_TIMEOUT}`);
            if(client.ws && client.ws.readyState !== WS.CLOSED && new Date().getTime() > client.lastUpdate + CONNECTION_TIMEOUT){
                client.lastUpdate = new Date().getTime();
                client.ws.terminate();
                console.log(`Client connection timed out (${uuid}); reconnection window starting`);
            } else if ((!client.ws || client.ws.readyState !== WS.OPEN) && new Date().getTime() > client.lastUpdate + RECONNECT_TIMEOUT) {
                console.log(`Reconnection window closed for client (${uuid})`);
                if(client.username && this.game.players[client.username] && !this.game.players[client.username].permanent){
                    console.log(`Removing non-permanent player ${client.username}`);
                    this.game.removePlayer(client.username);
                }
                if(client.ws)
                    client.ws.terminate();
                delete this.clients[uuid];
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
            ws.uuid = this.generateUUID();
            this.clients[ws.uuid] = {
                uuid: ws.uuid,
                ws,
                lastUpdate: new Date().getTime()
            };
            console.log(`Client connected (${ws.uuid})`);
            console.log(`- total clients: ${Object.keys(this.clients).length}`);
            ws.on('message', data => {
                this.clients[ws.uuid].lastUpdate = new Date().getTime();
                try {
                    return this.handleClientMsg(data, ws);
                } catch (e) {
                    console.error(e);
                }
            });
            ws.on('close', () => {
                // if(!ws.username)
                //     return;
                console.log(`Client ${ws.uuid} disconnected`);
                // if(this.game.players[ws.username] && !this.game.players[ws.username].permanent){
                //     console.log(`Removing non-permanent player ${ws.username}`);
                //     this.game.removePlayer(ws.username);
                // }

                // console.log(`Client ${ws.username} disconnected (start of reconnection window)`);
                // this.disconnectedClients.push({username:ws.username, time: new Date().getTime()});
                // TODO pongs with timeout to detect broken connections
            });
            this.send(ws, {msgtype: 'connect', uuid: ws.uuid});
            this.sendFullGamestate(ws);
        });
    }

    sendFullGamestate(ws){
        // console.log("Sending full gamestate...");
        this.send(ws, this.game);
    }

    sendLightGamestate(ws){
        let viewport = this.clients[ws.uuid].viewport;
        if(!viewport)
            return this.sendFullGamestate(ws);

        let gamestate = {
            spawn_cooldown: this.game.spawn_cooldown,
            players: this.game.players, // TODO could optimize this array too
            nodes: {} // send as obj instead of array since it's gonna be sparse
        };

        let padding = this.game.config.max_edge;
        for(var i = 0; i < this.game.nodes.length; i++){
            let node = this.game.nodes[i];
            if(node.x < viewport.left - padding || node.x > viewport.right + padding || node.y < viewport.top - padding || node.y > viewport.bottom + padding)
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
            this.clients[ws.uuid].username = msg.username;
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
            this.clients[ws.uuid].username = msg.username;
            this.send(ws, {msgtype: 'spawn_success', username: msg.username, spawn:spawn.id, color:msg.color});
        };

        handlers.viewport = msg => {
            this.clients[ws.uuid].viewport = msg;
            //ws.viewport = msg;
            this.clients[ws.uuid].lastupdate = new Date().getTime();
            //console.log("Nodes in viewport this frame:", this.game.nodes.filter(node => node.x >= ws.viewport.left && node.x <= ws.viewport.right && node.y <= ws.viewport.bottom && node.y >= ws.viewport.top).length);
        };

        handlers.registerPermanent = msg => {
            console.log("Registering a player as permanent");
            this.APIConnector.auth0RegisterPlayer(msg.id_token, this.clients[ws.uuid].username)
                .then(() => this.APIConnector.stripeExecutePayment(msg.stripe_token))
                .then(() => {
                    this.game.players[this.clients[ws.uuid].username].permanent = true;
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
                    this.clients[ws.uuid].username = player_name;


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

                    this.clients[ws.uuid].username = player_name;
                    this.send(ws, {msgtype: 'login_success', username:player_name, origin:origin.id, respawned, color:this.game.players[player_name].color});
                })
                .catch(err => {
                    console.error(err);
                    this.send(ws, {msgtype: 'login_failed'});
                })
        }

        handlers.changeColor = msg => {
            console.log(`Changing color for user ${this.clients[ws.uuid].username} (color=${msg.color.toString(16)})`);

            // Failed
            if(!this.clients[ws.uuid].username){
                let error='User not spawned yet';
                console.error(error);
                return this.send(ws, {
                    msgtype:'changeColor_failed',
                    error
                });
            }

            // Success
            this.game.players[this.clients[ws.uuid].username].color = msg.color;
            this.send(ws, {
                msgtype:'changeColor_success',
                color:msg.color
            });
        };

        /*
        handlers.changeName = msg => {
            console.log(`Changing username for player ${this.clients[ws.uuid].username} to ${msg.username}`);

            // Not spawned yet
            if(!this.clients[ws.uuid].username){
                let error='User not spawned yet';
                console.error(error);
                return this.send(ws, {
                    msgtype:'changeName_failed',
                    error,
                    username:this.clients[ws.uuid].username
                });
            }

            // Validation
            let valid = true;
            if(msg.username !== this.clients[ws.uuid].username)
                valid = this.validateUsername(msg.username);
            if(valid !== true){
                console.error(valid);
                return this.send(ws, {msgtype: 'changeName_failed', error: valid, username: this.clients[ws.uuid].username});
            }

            if(this.game.changeName(this.clients[ws.uuid].username, msg.username)){
                this.clients[ws.uuid].username = msg.username;
                this.send(ws, {
                    msgtype:'changeName_success',
                    username:msg.username
                });
            } else
                return this.send(ws, {msgtype: 'changeName_failed', error: 'Unknown error', username: this.clients[ws.uuid].username});
            
        };
        */

        handlers.createEdge = msg => this.game.createEdge(this.clients[ws.uuid].username, msg.from, msg.to);
        handlers.removeEdge = msg => this.game.removeEdge(this.clients[ws.uuid].username, msg.from, msg.to);

        handlers.reconnect = msg => {
            let client = null;
            for(var uuid in this.clients){
                if(uuid === msg.uuid){
                    client = this.clients[uuid];
                    break;
                }
            }
            if(client === null){
                console.error(`Refusing reconnection request from unrecognized client ${msg.uuid}`);
                this.send(ws, {msgtype:'reconnect_failed', error: 'Client instance expired or does not exist.', uuid: ws.uuid});
                return;
            }
            if(client.ws && client.ws.readyState !== WS.CLOSED){
                console.log(`Closing old websocket for client ${client.uuid}`);
                client.ws.terminate();
            }
            console.log(`Accepted reconnection for client ${client.uuid}`);
            client.ws = ws;
            delete this.clients[ws.uuid];
            ws.uuid = client.uuid;
            let player = this.game.players[client.username];
            this.send(ws, {
                msgtype: 'reconnect_success',
                uuid: ws.uuid,
                username: client.username,
                color: player ? this.game.players[client.username].color : null,
                permanent: player ? this.game.players[client.username].permanent : null
            });
            client.lastUpdate = new Date().getTime();
        }

        handlers.ping = () => {};

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

    serialize(data, replacer){
        // TODO: msgpack
        return JSON.stringify(data, replacer);
    }

    send(ws, obj){
        if(!ws){
            console.error("Could not send object; no socket specified", obj);
            return false;
        } else if (!obj) {
            console.error("Server.send called with only one argument (did you forget to pass the websocket instance as the first parameter?)");
            return false;
        } else if (ws.readyState !== WS.OPEN){
            return false;
        }
        ws.send(this.serialize(obj));
    }

    save(){
        fs.writeFileSync(client_cache, this.serialize(this.clients, (key, val) => key === 'ws' ? undefined : val));
        fs.writeFileSync(gamestate_cache, this.serialize(this.game));
        return true;
    }

    load(){
        console.log("Loading server state from disk...");
        if(fs.existsSync(client_cache)){
            this.clients = this.deserialize(fs.readFileSync(client_cache));
            console.log(`- Client cache loaded (${Object.keys(this.clients).length} clients)`);
        } else 
            console.log("- No client cache found.");

        if(fs.existsSync(gamestate_cache)){
            if(!this.game) this.game = new Game();
            let savedGame = this.deserialize(fs.readFileSync(gamestate_cache));
            _.merge(this.game, savedGame);

            // // Remove non-permanent players
            // for (var player in this.game.players) {
            //     if (this.game.players.hasOwnProperty(player) && !this.game.players[player].permanent) {
            //         this.game.removePlayer(player);
            //         console.log(`- Removed non-permanent player ${player}`);
            //     }
            // }

            console.log("- Gamestate loaded.");
            return true;
        }
        console.log("- No saved gamestate found.");
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
