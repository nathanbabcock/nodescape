/*
 * This file is not intended to be run as an actual class,
 * it just holds snippets to inject into the console
 * for recording tutorial GIFs
 */

class Tutorial {
    gif_1(){
        document.getElementById("spawn").style.display="none";
        //game.nodes.forEach(node => node.sprite.visible = false);

        game.players["excalo"] = {color: 0x4C62FF};
        render.player = "excalo";

        let myNode = new Node(game.config.width/2, game.config.height/2, false);
        myNode.owner = "excalo";
        myNode.id = game.nodes.length;
        game.nodes.push(myNode);

        let myNode2 = new Node(game.config.width/2 + 10, game.config.height/2, false);
        myNode2.owner = "excalo";
        myNode2.id = game.nodes.length;
        game.nodes.push(myNode2);

        let text = document.createElement("div");
        text.innerHTML = "Click and drag from a <b>node</b> you own<br>to create an <b>edge</b>.";
        text.className = "tutorial";
        document.body.appendChild(text);
        //     src.id = game.nodes.length;
        //     //src.owner = "excalo";
        //     game.nodes.push(src);
    }

    gif_2(){
        document.getElementById("spawn").style.display="none";
        //game.nodes.forEach(node => node.sprite.visible = false);

        game.players["excalo"] = {color: 0x4C62FF};
        render.player = "excalo";

        let myNode = new Node(game.config.width/2, game.config.height/2, false);
        myNode.owner = "excalo";
        myNode.id = game.nodes.length;
        myNode.bubbles = 1;
        game.nodes.push(myNode);

        let myNode2 = new Node(game.config.width/2 + 10, game.config.height/2, false);
        myNode2.owner = "server";
        myNode2.id = game.nodes.length;
        game.nodes.push(myNode2);

        let text = document.createElement("div");
        text.innerHTML = "<b>Bubbles</b> travel along <b>edges</b><br>to capture other <b>nodes</b>.";
        text.className = "tutorial";
        document.body.appendChild(text);
        //     src.id = game.nodes.length;
        //     //src.owner = "excalo";
        //     game.nodes.push(src);
    }

    gif_3(){
        document.getElementById("spawn").style.display="none";
        //game.nodes.forEach(node => node.sprite.visible = false);

        game.players["excalo"] = {color: 0x4C62FF};
        render.player = "excalo";

        let myNode = new Node(game.config.width/2, game.config.height/2, true);
        myNode.owner = "excalo";
        myNode.id = game.nodes.length;
        myNode.bubbles = 1;
        game.nodes.push(myNode);

        let myNode2 = new Node(game.config.width/2 + 8, game.config.height/2 - 2, false);
        myNode2.owner = "server";
        myNode2.id = game.nodes.length;
        game.nodes.push(myNode2);

        let myNode3 = new Node(game.config.width/2 + 8, game.config.height/2 + 2, false);
        myNode3.owner = "server";
        myNode3.id = game.nodes.length;
        game.nodes.push(myNode3);

        let text = document.createElement("div");
        text.innerHTML = "<b>Source nodes</b> generate new <b>bubbles</b><br>on every <b>edge</b>.";
        text.className = "tutorial";
        document.body.appendChild(text);
        //     src.id = game.nodes.length;
        //     //src.owner = "excalo";
        //     game.nodes.push(src);
    }

    gif_4(){
        document.getElementById("spawn").style.display="none";
        //game.nodes.forEach(node => node.sprite.visible = false);

        game.players["excalo"] = {color: 0x4C62FF};
        render.player = "excalo";

        let myNode = new Node(game.config.width/2, game.config.height/2, false);
        myNode.owner = "excalo";
        myNode.id = game.nodes.length;
        game.nodes.push(myNode);

        let myNode2 = new Node(game.config.width/2 + 10, game.config.height/2, false);
        myNode2.owner = "excalo";
        myNode2.id = game.nodes.length;
        game.nodes.push(myNode2);

        let text = document.createElement("div");
        text.innerHTML = "Drag an <b>edge</b>'s arrowhead<br>to remove it.";
        text.className = "tutorial";
        document.body.appendChild(text);
        //     src.id = game.nodes.length;
        //     //src.owner = "excalo";
        //     game.nodes.push(src);
    }

    gif_5(){
        document.getElementById("spawn").style.display="none";
        //game.nodes.forEach(node => node.sprite.visible = false);

        game.players["excalo"] = {color: 0x4C62FF};
        render.player = "excalo";

        game.players["other"] = {color: 0xFF3D1C};


        let myNode = new Node(game.config.width/2, game.config.height/2, false);
        myNode.owner = "excalo";
        myNode.id = game.nodes.length;
        myNode.bubbles = 10;
        game.nodes.push(myNode);

        let myNode2 = new Node(game.config.width/2 + 10, game.config.height/2, false);
        myNode2.owner = "other";
        myNode2.id = game.nodes.length;
        myNode2.bubbles = 9;
        game.nodes.push(myNode2);

        game.createEdge("excalo", 0, 1);
        game.createEdge("other", 1, 0);

        let text = document.createElement("div");
        text.innerHTML = "Overwhelm another player's <b>node</b><br>to capture it!";
        text.className = "tutorial";
        document.body.appendChild(text);
        //     src.id = game.nodes.length;
        //     //src.owner = "excalo";
        //     game.nodes.push(src);
    }
}

let tutorial = new Tutorial();