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
        ws.onmessage = this.handleServerMessage;
    }

    send(obj){
        if(!this.ws){
            console.error("Could not send object; not connected to server", obj);
            return false;
        }
        this.ws.send(this.serialize(obj));
    }

    handleServerMessage(event){
        let msg = JSON.parse(event.data);
        // console.log(msg);
        _.merge(game, msg);
        //deepExtend(game, msg);
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