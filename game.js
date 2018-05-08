const config = {
    width: 10,
    height: 10,
    max_edge: 10,
    min_edge: 2,
    source_freq: 0.1,
    spawn_cooldown: 4,
    node_base_radius: 0.5,
    bubble_radius: 1
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

    distance(other){
        return Math.hypot(other.x - this.x, other.y - this.y);
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
                color: "black"
            },
            "excalo": {
                color: "red"
            }
        };
        this.spawn_cooldown = 0;
    }

    procgen(){
        let added = 0,
        failStreak = 0;
        outer: while(failStreak < 100){
            let newNode = new Node(chance.integer({ min: 0, max: this.config.width}), chance.integer({min: 0, max: this.config.height}));
            for(var i = 0; i < this.nodes.length; i++){
                let dist = newNode.distance(this.nodes[i]);
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
    }

    updateEdge(edge){
        let opposingEdge = this.getOpposingEdge(edge),
            toNode = this.nodes[edge.to],
            fromNode = this.nodes[edge.from],
            edgeLength = fromNode.distance(toNode) - toNode.radius;

        edge.bubbles.forEach(bubble => {
            if(bubble.dead) return;

            // Move
            bubble.pos += this.config.bubble_radius;

            // Check collision with node
            if(bubble.pos >= edgeLength){
                console.log("Bubble hit node");
                if(bubble.owner === toNode.owner)
                    toNode.bubbles++;
                else
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
}