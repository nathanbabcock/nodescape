class Client {
    constructor(username){
        this.username = username;
    }

    setGame(game){
        if(this.gameloop) clearInterval(this.gameloop);
        this.game = game;
        this.gameloop = setInterval(this.game.update.bind(this.game), this.game.config.tick_rate);

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

    connect(url){
        let ws = this.ws = new WebSocket(url);
        ws.onopen = () => {
            console.log("Succesfully connected to websocket server")
            ws.send(this.serialize({
                msgtype: "playerconnect",
                username: this.username,
                color: this.game.players[this.username].color//0x01F45D,
            }));
        }
        ws.onmessage = this.handleServerMessage.bind(this);
    }

    send(obj){
        if(!this.ws){
            console.error("Could not send object; not connected to server", obj);
            return false;
        }
        this.ws.send(this.serialize(obj));
    }

    handleServerMessage(event){
        let gamestate = JSON.parse(event.data);
        _.merge(game, gamestate);
        // console.log(gamestate);

        // Handle deletions
        this.game.nodes.splice(gamestate.nodes.length);
        for(var node = 0; node < this.game.nodes.length; node++){
            this.game.nodes[node].edges.splice(gamestate.nodes[node].edges.length);
            // TODO also splice bubbles?
        }
        //TODO also need to clean these up from the renderer
    }

    deserialize(data){
        // TODO: msgpack
        // TODO: move this to a common Network class
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