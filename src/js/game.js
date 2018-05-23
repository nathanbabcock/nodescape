// Require
if(typeof module !== "undefined"){
    chance = new require('chance')();
}

const config = {
    width: 50,
    height: 50,
    max_edge: 10,
    min_edge: 5,
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
        this.owner = "server";
        this.edges = [];

        // deterministic
        this.radius = config.node_base_radius;
    }
}

class Edge {
    constructor(from, to){
        this.from = from;
        this.to = to;
        this.bubbles = [];
        this.dead = false;
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
                color: parseInt(chance.color({format: '0x'}))//0x4286f4
            }
        };
        this.spawn_cooldown = 0;
        this.last_update = Date.now();
        this.callbacks = [];
    }

    // Observability
    on(event, callback){
        if(!this.callbacks[event]) this.callbacks[event] = [];
        this.callbacks[event].push(callback);
    }

    notify(event, ...params){
        if(!this.callbacks[event]) return;
        this.callbacks[event].forEach(callback => callback(...params));
    }

    // Utility
    distance(a, b){
        return Math.hypot(b.x - a.x, b.y - a.y);
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

    getNeighbors(node, radius=this.config.max_edge){
        return this.nodes.filter(other => this.distance(node, other) <= radius && node !== other);
    }

    getNodeRadius(node){ // Get node radius by capacity
        let radius = Math.log10(node.bubbles) + 1;
        if(radius < 1) radius = 1;
        if(radius > 10) radius = 10;
        return radius;
    }

    countEdges(){
        let count = 0;
        this.nodes.forEach(node => count += node.edges.filter(edge=>!edge.dead).length); // If I was a good functional programmer I would probably use a reduce op...
        return count;
    }

    countBubbles(){
        let count = 0;
        this.nodes.forEach(node => {
            node.edges.forEach(edge => {
                if(edge.dead) return;
                count += edge.bubbles.filter(bubble => !bubble.dead).length;
            });
        });
        return count;
    }

    // Procgen
    procgen(){
        let added = 0,
        failStreak = 0;
        outer: while(failStreak < 10){
            let newNode = new Node(chance.integer({ min: 0, max: this.config.width}), chance.integer({min: 0, max: this.config.height}));
            let neighbors = 0;
            for(var i = 0; i < this.nodes.length; i++){
                let dist = this.distance(newNode, this.nodes[i]);
                if(dist > this.config.max_edge) continue;
                
                if(dist < this.config.min_edge){
                    failStreak++;
                    // console.log("failed to add node");
                    continue outer;
                }

                neighbors++;
            }
            // if(neighbors <= 0){
            //     failStreak++;
            //     continue outer;
            // }
            newNode.id = this.nodes.length;
            newNode.isSource = chance.bool({likelihood: this.config.source_freq * 100});
            this.nodes.push(newNode);
            // console.log("added a node");
            added++;
            failStreak = 0;
        }
    }

    // Update
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
                if((node.isSource || node.bubbles > 0) && !edge.dead){
                    this.spawnBubble(node, edge);
                    //edge.bubbles.push(new Bubble(node.owner, node.radius));
                    // console.log("Bubble spawned");
                    if(!node.isSource) node.bubbles--;
                }
            });
        }

        node.radius = this.getNodeRadius(node); // TODO move this?
    }

    spawnBubble(node, edge){
        var bubble = null;
        for(var i = 0; i < edge.bubbles.length; i++){
            if(edge.bubbles[i].dead){
                bubble = edge.bubbles[i];
                bubble.dead = false;
                break;
            }
        }
        if(bubble === null){
            bubble = new Bubble();
            edge.bubbles.push(bubble);
        }
        bubble.owner = node.owner;
        bubble.pos = node.radius;
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
                // console.log("Bubble hit node");
                if(toNode.isSource)
                    ;// do nothing
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

    // Player input
    createEdge(player, fromId, toId){
        let from = this.nodes[fromId],
            to = this.nodes[toId];

        // Validation
        if(from.owner !== player){
            // console.error(`Possible hack attempt identified: user ${player} trying to build an edge on someone else's node`);
            return false;
        }
        if(this.distance(from, to) > this.config.max_edge){
            // console.error(`Possible hack attempt: user ${player} trying to build an edge to a node that is too far away`);
            return false;
        }
        if(from.edges.find(e=>!e.dead && e.to === toId)){
            // console.error(`Possible hack attempt: user ${player} trying to build a duplicate edge`);
            return false;
        }

        // Object pooling
        let edge = null;
        for(var i = 0; i < from.edges.length; i++){
            if(from.edges[i].dead){
                edge = from.edges[i];
                edge.dead = false;
                break;
            }
        }
        if(edge === null){
            edge = new Edge();
            from.edges.push(edge);
        }
        
        edge.from = fromId;
        edge.to = toId;
        this.notify("createEdge", player, fromId, toId);
        return true;
    }

    removeEdge(player, fromId, toId){
        let from = this.nodes[fromId],
            to = this.nodes[toId];
        if(from.owner !== player){
            console.error(`Possible hack attempt identified: user ${player} trying to remove an edge on someone else's node`);
            return false;
        }
        // let index = from.edges.findIndex(edge => edge.from === fromId && edge.to === toId);
        // from.edges.splice(index, 1);
        let edge = from.edges.find(edge => edge.from === fromId && edge.to === toId);
        if(!edge) {
            console.error(`Could not find edge from ${fromId} to ${toId}`);
            return;
        }
        edge.dead = true;
        edge.bubbles.forEach(bubble => bubble.dead = true);
        this.notify("removeEdge", player, fromId, toId);
        return true;
    }

    getSpawn(){
        const SPAWN_POSSIBILITIES = 5;
        let center = {x: this.config.width / 2, y: this.config.height / 2};
        let centerNodes = [];
        this.nodes.filter(node => node.isSource && node.owner === 'server').forEach(node => {
            let dist = this.distance(center, node);
            if(centerNodes.length === 0){
                centerNodes.push(node);
                return;
            }
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

    removePlayer(player){
        delete this.players[player];

        this.nodes.forEach(node => {
            if(node.owner === player){
                node.owner = 'server';
                node.bubbles = 0;
                node.edges.forEach(edge => {
                    edge.dead = true;
                    edge.bubbles.forEach(bubble =>bubble.dead = true);
                });
            }
        });
    }
}

// Node
if(typeof module !== "undefined")
    module.exports = {Game, Node, Edge, Bubble};

// Browser
if (typeof window === "object")
    window.Game = Game;