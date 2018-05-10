// Render Config
const renderConfig = {
    scale:25
};

class Render {
    constructor(){
        this.game = null;
        this.gameloop = null;
        this.dragFrom = null;
        this.dragTo = null;
        this.dragGfx = null;
        this.initPixi();
        // initGame();
    }

    setGame(game){
        if(this.gameloop) clearInterval(this.gameloop);
        this.game = game;
        //this.gameloop = setInterval(this.game.update.bind(this.game), this.game.config.tick_rate);
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
        this.app.stage.on("mouseup", this.stopDrag);
        // this.app.view.style.opacity = 0;

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

        // Render Loop
        // TODO clean this up
        this.app.ticker.add(this.draw.bind(this));
    }

    // Nodes
    createNodeGraphics(node){
        let gfx = new PIXI.Graphics();
        gfx.interactive = true;
        gfx.hitArea = new PIXI.Circle(node.x * renderConfig.scale, node.y * renderConfig.scale, node.radius * renderConfig.scale);
        gfx.on('mousedown', () => this.startDrag(node));
        gfx.on('mouseup', this.stopDrag.bind(this));
        gfx.on('mouseupoutside', this.stopDrag.bind(this));
        gfx.on('mouseover', () => this.dragTo = node===this.dragFrom ? null : node);
        gfx.on('mouseout', () => this.dragTo = null);
        this.node_layer.addChild(gfx);
        return gfx;
    }

    createNodeText(node){
        let style = new PIXI.TextStyle({
            fontFamily: 'Arial',
            fontSize: renderConfig.scale,
            fill: '#ffffff'
        });
        let txt = new PIXI.Text("-1", style);
        txt.x = node.x * renderConfig.scale - renderConfig.scale / 2;
        txt.y = node.y * renderConfig.scale - renderConfig.scale / 2;
        this.node_layer.addChild(txt);
        return txt;
    }

    drawNode(node){
        if(!node.graphics) node.graphics = this.createNodeGraphics(node);
        if(!node.text) node.text = this.createNodeText(node);
        let gfx = node.graphics;
        gfx.clear();
        gfx.beginFill(this.game.players[node.owner].color);
        gfx.drawCircle(node.x * renderConfig.scale, node.y * renderConfig.scale, node.radius * renderConfig.scale);
        gfx.endFill();
        node.text.text = node.isSource ? '∞' : node.bubbles;
    }

    // Edges
    createEdgeGraphics(edge){
        let gfx = new PIXI.Graphics();
        this.edge_layer.addChild(gfx);
        return gfx;
    }
    
    drawEdge(edge){
        if(!edge.graphics) edge.graphics = this.createEdgeGraphics(edge);
        let gfx = edge.graphics,
            from = this.game.nodes[edge.from],
            to = this.game.nodes[edge.to];
        gfx.clear();
        gfx.lineStyle(2, (from.owner === to.owner) ? this.game.players[from.owner].color : 0x010101);
        gfx.moveTo(from.x * renderConfig.scale, from.y * renderConfig.scale);
        gfx.lineTo(to.x * renderConfig.scale, to.y * renderConfig.scale);
    }

    // Bubbles
    createBubbleGraphics(bubble){
        let gfx = new PIXI.Graphics();
        gfx.interactive = true;
        gfx.hitArea = new PIXI.Circle(); // need params?
        gfx.on('click', () => console.log("Clicked bubble ", bubble));
        this.bubble_layer.addChild(gfx);
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
        if(!bubble.graphics) bubble.graphics = this.createBubbleGraphics(bubble);

        // Interpolate movement between grid squares
        let delta_time = Date.now() - this.game.last_update,
             tick_ratio = delta_time / this.game.config.tick_rate,
             interp_pos = bubble.pos + tick_ratio * this.game.config.bubble_radius;

        // Now convert distance on the node to (x, y)
        let from = this.game.nodes[edge.from],
            to = this.game.nodes[edge.to],
            edge_length = this.game.distance(from, to),
            pos_ratio = interp_pos / edge_length,
            delta_x = to.x - from.x,
            delta_y = to.y - from.y,
            x = from.x + delta_x * pos_ratio,
            y = from.y + delta_y * pos_ratio,
            gfx = bubble.graphics,
            radius = this.game.config.bubble_radius;
        
        // Draw
        gfx.hitArea.x = x * renderConfig.scale;
        gfx.hitArea.y = y * renderConfig.scale; 
        gfx.hitArea.radius = radius * renderConfig.scale; // TODO one line with destructuring?
        gfx.clear();
        gfx.beginFill(this.game.players[bubble.owner].color);
        gfx.drawCircle(x * renderConfig.scale, y * renderConfig.scale, radius * renderConfig.scale);
        gfx.endFill();
    }

    // Drag
    drawDrag(){
        if(!this.dragGfx) this.dragGfx = this.createEdgeGraphics();
        let gfx = this.dragGfx;
        if(!this.dragFrom){
            gfx.clear();
            return;
        }
        let mouse = this.app.renderer.plugins.interaction.mouse.getLocalPosition(render.viewport);
        gfx.clear();
        gfx.lineStyle(2, 0x010101);
        gfx.moveTo(this.dragFrom.x * renderConfig.scale, this.dragFrom.y * renderConfig.scale);
        gfx.lineTo(mouse.x, mouse.y);
    }

    // Draw
    draw(){
        this.game.nodes.forEach(node => {
            this.drawNode(node);
            node.edges.forEach(edge => {
                this.drawEdge(edge);
                edge.bubbles.forEach(bubble => this.drawBubble(bubble, edge));
            })
        });
        this.drawDrag();

        this.app.renderer.render(this.app.stage);
    }

    // Edge dragging
    startDrag(node){
        console.log("Start edge drag");
        this.viewport.pause = true;
        this.dragFrom = node;
    }

    stopDrag(){
        console.log("Stop edge drag");
        this.viewport.pause = false;
        this.dragFrom = null;
        this.dragTo = null;
    }

}

