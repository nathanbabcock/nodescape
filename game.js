const config = {
    width: 100,
    height: 100,
    max_edge: 20,
    min_edge: 2,
    source_freq: 0.1,
    spawn_cooldown: 4,
    node_base_radius: 1,
    bubble_radius: 0.5,
    tick_rate: 250,
};
config.bubble_move_speed = 4 * config.bubble_radius;

class Node {
    constructor(x, y, isSource = false){
        // unchanging
        this.id = -1;
        this.x = x;
        this.y = y;
        this.isSource = isSource;

        // dynamic
        this.bubbles = 0;
        this.radius = config.node_base_radius;
        this.owner = "server";
        this.edges = [];
    }
}

class Edge {
    constructor(from, to){
        this.from = from;
        this.to = to;
        this.bubbles = [];
    }
}

class Bubble {
    constructor(owner, pos = 0){
        this.owner = owner;
        this.pos = pos;
        this.dead = false;
    }
}

class Game {
    constructor(isServer=false){
        this.isServer = isServer;
        this.nodes = [];
        this.config = config;
        this.players = {
            "server": {
                color: 0x707070
            },
            "excalo": {
                color: 0x4286f4
            }
        };
        this.spawn_cooldown = 0;
        this.last_update = Date.now();
    }

    distance(a, b){
        return Math.hypot(b.x - a.x, b.y - a.y);
    }

    procgen(){
        let added = 0,
        failStreak = 0;
        outer: while(failStreak < 100){
            let newNode = new Node(chance.integer({ min: 0, max: this.config.width}), chance.integer({min: 0, max: this.config.height}));
            for(var i = 0; i < this.nodes.length; i++){
                let dist = this.distance(newNode, this.nodes[i]);
                if(dist > this.config.max_edge) continue;
                
                if(dist % 1 > 0 || dist < this.config.min_edge){
                    failStreak++;
                    console.log("failed to add node");
                    continue outer;
                }
            }
            newNode.id = this.nodes.length;
            newNode.isSource = chance.bool({likelihood: this.config.source_freq * 100});
            this.nodes.push(newNode);
            console.log("added a node");
            added++;
            failStreak = 0;
        }
    }

    update(){
        this.spawn_cooldown--;

        this.nodes.forEach(this.updateNode, this);

        if(this.spawn_cooldown <= 0) this.spawn_cooldown = this.config.spawn_cooldown;
        this.last_update = Date.now();
    }

    updateNode(node){
        node.edges.forEach(this.updateEdge, this);

        if(this.spawn_cooldown <= 0){
            node.edges.forEach(edge => {
                if(node.isSource || node.bubbles > 0){
                    edge.bubbles.push(new Bubble(node.owner, node.radius));
                    console.log("Bubble spawned");
                    if(!node.isSource) node.bubbles--;
                }
            });
        }

        node.radius = this.getNodeRadius(node); // TODO move this?
    }

    updateEdge(edge){
        let opposingEdge = this.getOpposingEdge(edge),
            toNode = this.nodes[edge.to],
            fromNode = this.nodes[edge.from],
            edgeLength = this.distance(fromNode, toNode) - toNode.radius;

        edge.bubbles.forEach(bubble => {
            if(bubble.dead) return;

            // Move
            bubble.pos += this.config.bubble_radius;

            // Check collision with node
            if(bubble.pos >= edgeLength){
                console.log("Bubble hit node");
                if(bubble.owner === toNode.owner)
                    toNode.bubbles++;
                else if(toNode.bubbles <= 0){
                    toNode.owner = bubble.owner;
                    toNode.bubbles++;
                } else
                    toNode.bubbles--;
                bubble.dead = true;
            }

            // Check collision with enemy bubble
            if(bubble.owner === toNode.owner) return;
            if(opposingEdge == undefined) return;
            for(var i = 0; i < opposingEdge.bubbles.length; i++){
                let enemyBubble = opposingEdge.bubbles[i];
                if(Math.abs(enemyBubble.pos - bubble.pos) <= 2 * this.config.bubble_radius){
                    bubble.dead = true;
                    enemyBubble.dead = true;
                    break;
                }
            }
        });
    }

    getOpposingEdge(edge){
        let node = this.nodes[edge.to];
        if(node == undefined) return null;
        return node.edges.find(otherEdge => otherEdge.to === edge.from);
    }

    printmap(){
        let output = "";
        for(var x = 0; x < this.config.width; x++){
            for(var y = 0; y < this.config.height; y++){
                let node;
                if(node = this.nodes.find(node => node.x === x && node.y === y))
                    output += node.isSource ? "s" : "x";
                else
                    output += " ";
            }
            output += "\n";
        }
        console.log(output);
    }

    createEdge(player, fromId, toId){
        let from = this.nodes[fromId],
            to = this.nodes[toId];
        if(from.owner !== player){
            console.error(`Possible hack attempt identified: user ${player} trying to build an edge on someone else's node`);
            return false;
        }
        if(this.distance(from, to) > this.config.max_edge){
            console.error(`Possible hack attempt: user ${player} trying to build an edge to a node that is too far away`);
            return false;
        }
        from.edges.push(new Edge(fromId, toId));
        return true;
    }

    removeEdge(player, fromId, toId){
        let from = this.nodes[fromId],
            to = this.nodes[toId];
        if(from.owner !== player){
            console.error(`Possible hack attempt identified: user ${player} trying to remove an edge on someone else's node`);
            return false;
        }
        let index = from.edges.findIndex(edge => edge.from === fromId && edge.to === toId);
        from.edges.splice(index, 1);
        return true;
    }

    getNeighbors(node, radius=this.config.max_edge){
        return this.nodes.filter(other => this.distance(node, other) <= radius && node !== other);
    }

    // Client commands
    clientCreateEdge(fromNode, toNode){
        return {
            "CLIENT_COMMAND": "CREATE_EDGE",
            "from": fromNode,
            "to": toNode
        }
    }

    clientDeleteEdge(fromNode, toNode){
        return {
            "CLIENT_COMMAND": "DELETE_EDGE",
            "from": fromNode,
            "to": toNode
        }
    }

    getNodeRadius(node){ // Get node radius by capacity
        let radius = Math.log10(node.bubbles) + 1;
        if(radius < 1) radius = 1;
        if(radius > 10) radius = 10;
        return radius;
    }
}

// Node
if(typeof module !== "undefined")
    module.exports = {Game, Node, Edge, Bubble};

// Browser
if (typeof window === "object")
    window.Game = Game;