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
    }

    distance(other){
        return Math.hypot(other.x - this.x, other.y - this.y);
    }
}

class Edge {
    constructor(to){
        this.to = to;
        this.bubbles = [];
    }
}

class Bubble {
    constructor(owner){
        this.owner = owner;
        this.pos = 0;
        this.dead = false;
    }
}

class Game {
    constructor(){
        this.nodes = [];
        this.config = {
            width: 100,
            height: 100,
            max_edge: 10,
            min_edge: 2,
        };
        this.players = {
            "server": {
                color: "black"
            },
            "excalo": {
                color: "red"
            }
        };
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
            this.nodes.push(newNode);
            console.log("added a node");
            added++;
            failStreak = 0;
        }
    }

    printmap(){
        let output = "";
        for(var x = 0; x < this.config.width; x++){
            for(var y = 0; y < this.config.height; y++){
                if(this.nodes.find(node => node.x === x && node.y === y))
                    output += "x";
                else
                    output += " ";
            }
            output += "\n";
        }
        console.log(output);
    }
}