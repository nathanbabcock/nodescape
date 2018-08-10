class Client {
    constructor(username){
        this.username = username;
        this.uuid = null;
        this.lastUpdate = -1;
        this.ws = null;
    }

    setGame(game){
        if(this.gameloop) clearInterval(this.gameloop);
        this.game = game;
        this.startGameLoop();
        //this.gameloop = setInterval(this.game.update.bind(this.game), this.game.config.tick_rate);

        // Game listeners
        this.game.on("createEdge", (player, from, to) => { this.send({
            msgtype: "createEdge",
            from: from,
            to: to
        })});
        this.game.on("removeEdge", (player, from, to) => { this.send({
            msgtype: "removeEdge",
            from: from,
            to: to
        })});

        return game;
    }

    setRender(render){
        this.render = render;
    }

    setUI(ui){
        this.ui = ui;
    }

    connect(url){
        this.url = url;
        this.ws = new WebSocket(url);
        this.ws.onopen = () => {
            console.log("Succesfully connected to websocket server");
            if(this.ui) this.ui.onConnect();
            this.startClientUpdateLoop();
            // ws.send(this.serialize({
            //     msgtype: "playerconnect",
            //     username: this.username,
            //     color: this.game.players[this.username].color//0x01F45D,
            // }));
        }

        this.ws.onmessage = this.handleServerMessage.bind(this);
    }

    reconnect(){
        //TODO maybe this reconnect method is insecure (anyone could spoof a reconnect and steal someone's idle instance)
        //Only applies to f2p plebs so no incentive to fix B)
        console.log("Reconnecting...");
        this.lastUpdate = new Date().getTime();
        if(this.ws) this.ws.close();
        this.ws = new WebSocket(this.url);
        // console.log(this.ws);
        this.ws.onopen = () => {
            console.log("Regained connection to websocket server");
            //if(this.ui) this.ui.onReconnect();
            //this.startClientUpdateLoop();
            // this.send({
            //     msgtype: "reconnect",
            //     username: this.render.player
            // });
        }

        this.ws.onmessage = this.handleServerMessage.bind(this);
    }

    send(obj){
        if(!this.ws){
            console.error("Could not send object; websocket not initialized", obj);
            return false;
        } else if(this.ws.readyState !== WebSocket.OPEN){
            console.error(`Could not send object; websocket readyState=${this.ws.readyState}`);
            return false;
        }
        this.ws.send(this.serialize(obj));
    }

    spawn(username, color){
        this.send({
            msgtype: "spawnplayer",
            username: username,
            color: color
        });
    }

    startGameLoop(){
        if(this.gameloop) clearInterval(this.gameloop);
        this.gameloop = setInterval(() => {
            this.game.update();
        }, this.game.config.tick_rate);
    }

    startClientUpdateLoop(){
        const CONNECTION_TIMEOUT = 5 * 1000;
        if(this.clientupdateloop) clearInterval(this.clientupdateloop);
        this.clientupdateloop = setInterval(() => {
            if(new Date().getTime() > this.lastUpdate + CONNECTION_TIMEOUT){
                console.log("Server connection timed out.");
                this.reconnect();
            } else {
                if(this.render === undefined)
                    this.send({msgtype:'ping'});
                else
                    this.send({
                        msgtype: "viewport",
                        top: this.render.viewport.top / renderConfig.scale,
                        right: this.render.viewport.right / renderConfig.scale,
                        bottom: this.render.viewport.bottom / renderConfig.scale,
                        left: this.render.viewport.left / renderConfig.scale,
                    });
            }
        }, 1000);
    }

    handleServerMessage(event){
        let msg = this.deserialize(event.data);
        this.lastUpdate = new Date().getTime();
        // console.log(msg);

        let handlers = {};

        handlers.connect = () => {
            if(this.uuid !== null && this.uuid !== undefined)
                return this.send({msgtype: 'reconnect', uuid: this.uuid});
            this.uuid = msg.uuid;
            console.log(`Client id: ${msg.uuid}`);
        };

        handlers.reconnect_failed = () => {
            console.log("Reconnect request rejected by server. New client ID is ", msg.uuid);
            this.uuid = msg.uuid;
        }

        handlers.spawn_success = () => {
            let spawn = this.game.nodes[msg.spawn];
            if(this.render) this.render.player = msg.username;
            this.render.viewport.snap(spawn.x * renderConfig.scale, spawn.y * renderConfig.scale, {removeOnComplete:true, time:1500});
            this.render.viewport.snapZoom({width:1895, removeOnComplete:true, time:1500});
            //this.render.viewport.moveCenter(spawn.x * renderConfig.scale, spawn.y * renderConfig.scale);
            //spawn.sprite.tint = this.game.players[msg.username].color;
            console.log(`Succesfully spawned at ${msg.spawn}`);
            if(this.ui) {
                this.ui.dom.topbar_username.innerHTML = this.ui.dom.topbar_username_input.value = msg.username;
                this.ui.dom.topbar_permanent.style.display = "none";
                this.ui.dom.topbar_register.style.display = "inline-block";
                this.ui.dom.topbar_color.jscolor.fromString(msg.color.toString(16)); 
                this.ui.dom.topbar_username.style.color = this.ui.dom.topbar_username_input.style.color = `#${msg.color.toString(16)}`;
                this.ui.onSpawn();
            }
        };

        handlers.login_success = () => {
            let origin = this.game.nodes[msg.origin];
            if(this.render) this.render.player = msg.username;
            this.render.viewport.snap(origin.x * renderConfig.scale, origin.y * renderConfig.scale, {removeOnComplete:true, time:1500});
            this.render.viewport.snapZoom({width:1895, removeOnComplete:true, time:1500});
            console.log(`Succesfully logged in user ${msg.username}`);
            if(this.ui){
                this.ui.onSpawn();
                this.ui.dom.topbar_username.innerHTML = this.ui.dom.topbar_username_input.value = msg.username;
                // console.log(`I see color ${msg.color.toString(16)}`);
                this.ui.dom.topbar_permanent.style.display = "inline-block";
                this.ui.dom.topbar_register.style.display = "none";
                this.ui.dom.topbar_color.jscolor.fromString(msg.color.toString(16));
                this.ui.dom.topbar_username.style.color = this.ui.dom.topbar_username_input.style.color = `#${msg.color.toString(16)}`;
            }
            if(msg.respawned) alert("Oh no! Every node in your network was captured by another player while you were offline. Here's a new spawnpoint from which to begin plotting your revenge."); // TODO refactor this to a modal/toast
        };

        handlers.spawn_failed = () => {
            console.error(msg.error);
            if(this.ui) this.ui.onSpawnFailed(msg.error);
        };

        handlers.register_success = () => {
            if(this.ui) this.ui.onRegisterSuccess();
        };
    
        handlers.changeColor_success = () => {
            if(this.ui) this.ui.dom.topbar_loading.style.display="none";
            console.log('Server completed changeColor request');
        };

        handlers.changeColor_failed = () => {
            if(this.ui){
                this.ui.dom.topbar_loading.style.display="none";
                this.ui.showTopBarError(msg.error);
                this.ui.dom.topbar_color.jscolor.fromString(msg.color.toString(16));
                this.ui.dom.topbar_username.style.color = this.ui.dom.topbar_username_input.style.color = `#${msg.color.toString(16)}`;
            }
        };

        handlers.changeName_success = handlers.changeName_failed = () => {
            if(this.ui){
                this.ui.dom.topbar_loading.style.display="none";
                this.render.player = msg.username;
            }
            console.log('Server completed changeName request');
        };

        handlers.changeName_failed = () => {
            if(this.ui){
                this.ui.dom.topbar_loading.style.display="none";
                this.ui.showTopBarError(msg.error);
                this.ui.dom.topbar_username.innerHTML = msg.username;
                this.ui.dom.topbar_username_input.value = msg.username;
            }
        };

        if(msg.msgtype && handlers[msg.msgtype] === undefined){
            console.error(`Unrecognized server msgtype ${msg.msgtype}`);
            return;
        }

        if(msg.msgtype){
            handlers[msg.msgtype]();
            return;
        }

        // Re-start gameloop to sync with server
        this.startGameLoop();

        // Default action: merge gamestate
        _.merge(this.game, msg);
        this.game.last_update = Date.now();
        // console.log(gamestate);

        // Handle deletions
        // this.game.nodes.splice(gamestate.nodes.length);
        // for(var node = 0; node < this.game.nodes.length; node++){
        //     this.game.nodes[node].edges.splice(gamestate.nodes[node].edges.length);
        // }
    }

    deserialize(data){
        // TODO: msgpack
        // TODO: move this to a common Network class
        // console.log(`websocket msg is ${data.length} bytes`);
        return JSON.parse(data);
    }

    serialize(data){
        // TODO: msgpack
        return JSON.stringify(data);
    }
}

// let client = new Client("excalo");
// client.setGame(new Game());
// client.connect("ws://localhost:9999");