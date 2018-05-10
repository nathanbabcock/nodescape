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
        this.selectedNode = null;
        this.selectedNodeGfx = null;
        this.player = "excalo";
        this.initPixi();
        // initGame();
    }

    setGame(game){
        if(this.gameloop) clearInterval(this.gameloop);
        this.game = game;
        //this.gameloop = setInterval(this.game.update.bind(this.game), this.game.config.tick_rate);
        return game;
    }

    // initGame(){
    //     let game = setGame(new Game());
        
    //     let src = new Node(5, 5, true);
    //     src.id = game.nodes.length;
    //     game.nodes.push(src);
        
    //     let dest = new Node(5, 9, false);
    //     dest.id = game.nodes.length;
    //     game.nodes.push(dest);

    //     let dest2 = new Node(9, 9, false);
    //     dest2.id = game.nodes.length;
    //     game.nodes.push(dest2);

    //     src.edges.push(new Edge(0,1));
    //     dest.edges.push(new Edge(1, 2));
    // }

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

        // Layers
        this.viewport.addChild(this.edge_layer = new PIXI.Container());
        this.viewport.addChild(this.node_layer = new PIXI.Container());
        this.viewport.addChild(this.bubble_layer = new PIXI.Container());

        // Render Loop
        // TODO clean this up
        this.app.ticker.add(this.draw.bind(this));
    }

    // Nodes
    createNodeGraphics(node){
        let gfx = new PIXI.Graphics();
        gfx.interactive = true;
        // gfx.hitArea = new PIXI.Circle(node.x * renderConfig.scale, node.y * renderConfig.scale, node.radius * renderConfig.scale);
        gfx.on('mousedown', () => this.startDrag(node));
        gfx.on('mouseup', this.stopDrag.bind(this));
        gfx.on('mouseupoutside', this.stopDrag.bind(this));
        gfx.on('mouseover', () => { this.dragTo = node===this.dragFrom ? null : node; this.selectedNode = node; });
        gfx.on('mouseout', () => { this.dragTo = null; this.selectedNode = null; });
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
        gfx.interactive = gfx.buttonmode = true;
        gfx.on('mousedown', () => this.startDrag(this.game.nodes[edge.from], this.game.nodes[edge.to]));
        gfx.on('mouseup', this.stopDrag.bind(this));
        gfx.on('mouseupoutside', this.stopDrag.bind(this));
        //gfx.hitArea = arrowhead;
        this.edge_layer.addChild(gfx);
        return gfx;
    }
    
    drawEdge(edge){
        if(!edge.graphics) edge.graphics = this.createEdgeGraphics(edge);

        let gfx = edge.graphics,
            from = this.game.nodes[edge.from],
            to = this.game.nodes[edge.to];
        gfx.clear();
        if(this.dragFrom === from && this.dragToOld === to) return;

        // Stop arrow just before they get to a node
        let dist = this.game.distance(from, to),
            delta_x = to.x - from.x,
            delta_y = to.y - from.y,
            to_ratio = to.radius / dist,
            from_ratio = from.radius / dist,
            fromx = (from.x + delta_x * from_ratio) * renderConfig.scale,
            fromy = (from.y + delta_y * from_ratio) * renderConfig.scale,
            tox = (to.x - delta_x * to_ratio) * renderConfig.scale,
            toy = (to.y - delta_y * to_ratio) * renderConfig.scale;

        this.drawArrow(gfx, fromx, fromy, tox, toy, (from.owner === to.owner) ? this.game.players[from.owner].color : 0x010101);
    }

    drawArrow(gfx, fromx, fromy, tox, toy, color){
        let headlen = 10,
            angle = Math.atan2(toy-fromy,tox-fromx);

        // Line
        gfx.lineStyle(2, color);
        gfx.moveTo(fromx, fromy);
        gfx.lineTo(tox, toy);

        // Arrowhead
        gfx.moveTo(fromx, fromy);
        gfx.lineTo(tox, toy);
        gfx.beginFill(color);
        gfx.moveTo(tox, toy);
        gfx.lineTo(tox-headlen*Math.cos(angle-Math.PI/6),toy-headlen*Math.sin(angle-Math.PI/6));
        gfx.lineTo(tox-headlen*Math.cos(angle+Math.PI/6),toy-headlen*Math.sin(angle+Math.PI/6));
        gfx.lineTo(tox,toy);
        gfx.endFill();
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
    drawDrag(){ // TODO this has some redudancy with drawEdge (ideally we should have a ghots Edge object that gets updated and rendered directly)
        if(!this.dragGfx) this.dragGfx = this.createEdgeGraphics();
        let gfx = this.dragGfx;
        if(!this.dragFrom){
            gfx.clear();
            return;
        }
        let mouse = this.app.renderer.plugins.interaction.mouse.getLocalPosition(render.viewport);

        let color = 0x010101;
        if(this.game.distance({x: mouse.x / renderConfig.scale, y: mouse.y / renderConfig.scale}, this.dragFrom) > this.game.config.max_edge)
            color = 0xFF0000;

        // Stop arrow just before they get to a node
        let from = this.dragFrom,
            to = mouse,
            dist = this.game.distance(from, to),
            delta_x = to.x - from.x,
            delta_y = to.y - from.y,
            to_ratio = to.radius / dist,
            from_ratio = from.radius / dist,
            // fromx = (from.x + delta_x * from_ratio) * renderConfig.scale,
            // fromy = (from.y + delta_y * from_ratio) * renderConfig.scale,
            fromx = from.x * renderConfig.scale,
            fromy = from.y * renderConfig.scale,
            tox = mouse.x,
            toy = mouse.y;

        // Snap to eligible nodes
        if(this.dragTo && !this.dragFrom.edges.find(a => a.to === this.dragTo.id) && color !== 0xFF0000){
            // Redo calculations whee
            to = this.dragTo;
            dist = this.game.distance(from, to);
            delta_x = to.x - from.x;
            delta_y = to.y - from.y;
            to_ratio = to.radius / dist;
            tox = (to.x - delta_x * to_ratio) * renderConfig.scale;
            toy = (to.y - delta_y * to_ratio) * renderConfig.scale;
            color = (this.dragFrom.owner === this.dragTo.owner) ? this.game.players[this.dragFrom.owner].color : 0x010101;
        }

        gfx.clear();
        this.drawArrow(gfx, fromx, fromy, tox, toy, color);
        // gfx.clear();
        // gfx.lineStyle(2, color);
        // gfx.moveTo(this.dragFrom.x * renderConfig.scale, this.dragFrom.y * renderConfig.scale);
        // gfx.lineTo(x, y);
    }

    //
    createSelectedNodeGraphics(node){
        let gfx = new PIXI.Graphics();
        this.edge_layer.addChild(gfx);
        return gfx;
    }

    drawSelectedNode(){
        if(!this.selectedNodeGfx) this.selectedNodeGfx = this.createSelectedNodeGraphics();
        let gfx = this.selectedNodeGfx;
        gfx.clear();
        // if(this.dragFrom) return;
        if(!this.selectedNode) return;
        this.game.getNeighbors(this.selectedNode).forEach(node => {
            if(this.selectedNode.edges.find(edge => edge.to === node.id)) return; // Edge already exists!
            if(node.edges.find(edge => edge.to === this.selectedNode.id)) return; // Edge already exists!
            if(node === this.dragFrom) return;
            gfx.lineStyle(1, 0xd6d6d6)
                .moveTo(this.selectedNode.x * renderConfig.scale, this.selectedNode.y * renderConfig.scale)
                .lineTo(node.x * renderConfig.scale, node.y * renderConfig.scale);
        });
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
        this.drawSelectedNode();

        this.app.renderer.render(this.app.stage);
    }

    // Edge dragging
    startDrag(node, dragToOld=null){
        if(node.owner !== this.player) return false;

        console.log("Start edge drag");
        this.viewport.pause = true;
        this.dragFrom = node;
        this.dragToOld = dragToOld;
    }

    stopDrag(){
        console.log("Stop edge drag");

        if(this.dragToOld)
            this.game.removeEdge(this.player, this.dragFrom.id, this.dragToOld.id);

        if(this.dragFrom !== null && this.dragTo !== null){
            if(!this.dragFrom.edges.find(a => a.to === this.dragTo.id)){
                this.dragFrom.edges.push(new Edge(this.dragFrom.id, this.dragTo.id));
            }
        }

        this.viewport.pause = false;
        this.dragFrom = null;
        this.dragTo = null;
        this.dragToOld = null;
    }

}

