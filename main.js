console.log("Hi");

const config = {
    width: 100,
    height: 100,
    node_radius: 10,
    min_node_separation: 2,
}

let nodes = [];

let failStreak = 0,
    added = 0;

function distance(a, b){
    return Math.hypot(b.x - a.x, b.y - a.y);
}

function procgen(){
    outer: while(failStreak < 100){
        let newNode = {x: chance.integer({ min: 0, max: config.width}), y: chance.integer({min: 0, max: config.height})};
        for(var i = 0; i < nodes.length; i++){
            let dist = distance(nodes[i], newNode);
            if(dist > config.node_radius) continue;
            
            if(dist % 1 > 0 || dist < config.min_node_separation){
                failStreak++;
                console.log("failed to add node");
                continue outer;
            }
        }
        nodes.push(newNode);
        console.log("added a node");
        added++;
        failStreak = 0;
    }
}

function printmap(){
    let output = "";
    for(var x = 0; x < config.width; x++){
        for(var y = 0; y < config.height; y++){
            if(nodes.find(node => node.x === x && node.y === y))
                output += "x";
            else
                output += " ";
        }
        output += "\n";
    }
    console.log(output);
}

function getNeighbors(mNode){
   return nodes.filter(node => distance(node, mNode) <= config.node_radius);
}

procgen();
printmap();