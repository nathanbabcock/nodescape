// Render Config
const renderConfig = {
    grid_size: 25,
    bubble_radius: 10,
};

class Render {
    constructor(){
        this.game = null;
        this.gameloop = null;
        this.initPixi();
        // initGame();
    }

    setGame(game){
        if(this.gameloop) clearInterval(this.gameloop);
        this.game = game;
        this.gameloop = setInterval(this.game.update.bind(this.game), this.game.config.tick_rate);
        return game;
    }

    initGame(){
        let game = setGame(new Game());
        
        let src = new Node(5, 5, true);
        src.id = game.nodes.length;
        game.nodes.push(src);
        
        let dest = new Node(5, 9, false);
        dest.id = game.nodes.length;
        game.nodes.push(dest);

        let dest2 = new Node(9, 9, false);
        dest2.id = game.nodes.length;
        game.nodes.push(dest2);

        src.edges.push(new Edge(0,1));
        dest.edges.push(new Edge(1, 2));
    }

    initPixi(){
        // Root app
        this.app = new PIXI.Application({
            antialias: true,
            autoStart: true,
            backgroundColor: 0xffffff,
            width: window.innerWidth - 25,
            height:window.innerHeight - 25,
        });
        window.addEventListener('resize', () => this.app.renderer.resize(window.innerWidth - 25, window.innerHeight - 25));
        document.body.appendChild(this.app.view);
        this.app.view.style.opacity = 0;

        // Viewport
        this.viewport = new Viewport({
            screenWidth: window.innerWidth,
            screenHeight: window.innerHeight,
            worldWidth: 1000,
            worldHeight: 1000
        }).drag()
            .wheel()
            .pinch()
            .decelerate();
        this.app.stage.addChild(this.viewport);

        // Graphics layers
        this.viewport.addChild(this.edge_layer = new PIXI.Container());
        this.viewport.addChild(this.bubble_layer = new PIXI.Container());
        this.viewport.addChild(this.node_layer = new PIXI.Container());
    }

    // Nodes
    createNodeGraphics(node){
        let gfx = new PIXI.Graphics();
        gfx.interactive = true;
        gfx.hitArea = new PIXI.Circle(base.x * renderConfig.grid_size, base.y * renderConfig.grid_size, renderConfig.base_radius);
        gfx.on('click', () => console.log("Clicked node ", node));
        node_layer.addChild(gfx);
        return gfx;
    }

    drawNode(node){
        if(!node.graphics) node.graphics = createNodeGraphics(node);
        let gfx = node.graphics;
        gfx.clear();
        gfx.beginFill(getnodeColor(node));
        gfx.drawCircle(node.x * renderConfig.grid_size, node.y * renderConfig.grid_size, renderConfig.node_radius);
        gfx.endFill();
    }

    // Edges
    createEdgeGraphics(edge){
        let gfx = new PIXI.Graphics();
        edge_layer.addChild(gfx);
        return gfx;
    }
    
    drawEdge(edge){
        if(!edge.graphics) edge.graphics = createEdgeGraphics(edge);
        let gfx = edge.graphics,
            from = this.game.nodes[edge.from],
            to = this.game.nodes[edge.to];
        gfx.clear();
        gfx.lineStyle(2, (from.owner === to.owner) ? this.game.players[from.owner].color : 0x010101);
        gfx.moveTo(from.x * renderConfig.grid_size, from.y * renderConfig.grid_size);
        gfx.lineTo(to.x * renderConfig.grid_size, to.y * renderConfig.grid_size);
    }

    // Bubbles
    createBubbleGraphics(bubble){
        let gfx = new PIXI.Graphics();
        gfx.interactive = true;
        gfx.hitArea = new PIXI.Circle(); // need params?
        gfx.on('click', () => console.log("Clicked bubble ", bubble));
        bubble_layer.addChild(gfx);
        return gfx;
    }

    drawBubble(bubble, edge){
        // Handle deads
        // TODO death anim here?
        if(bubble.dead && bubble.graphics)
            bubble.graphics.visible = false;
        
        else if(!bubble.dead && bubble.graphics && !bubble.graphics.visible)
            bubble.graphics.visible = true;

        if(bubble.dead) return;

        // Spawn graphics for the first time
        if(!bubble.graphics) bubble.graphics = createBubbleGraphics(bubble);

        // Interpolate movement between grid squares
        let delta_time = Date.now() - map.last_update,
             tick_ratio = delta_time / this.game.config.tick_rate,
             interp_pos = bubble.pos + tick_ratio * this.game.config.bubble_radius;

        // Now convert distance on the node to (x, y)
        let from = this.game.nodes[edge.from],
            to = this.game.nodes[edge.to],
            edge_length = from.distance(to),
            pos_ratio = interp_pos / edge_length,
            delta_x = to.x - from.x,
            delta_y = to.y - from.y,
            x = edge.from.x + delta_x * pos_ratio,
            y = edge.from.y + delta_y * pos-ratio,
            gfx = bubble.graphics,
            radius = renderConfig.bubble_radius;
        
        // Draw
        gfx.hitArea.x = x;
        gfx.hitArea.y = y; 
        gfx.hitArea.radius = radius; // TODO one line with destructuring?
        gfx.clear();
        gfx.beginFill(map.players[bubble.owner].color);
        gfx.drawCircle(x, y, radius);
        gfx.endFill();
    }

}

