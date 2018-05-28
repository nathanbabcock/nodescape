// Render Config
const renderConfig = {
    scale:25,
    arrowhead_size:20,
    line_thickness: 3
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
        this.player = null
        this.initPixi();
        // this.layers = {}; // TODO?
        // initGame();
    }

    setGame(game){
        if(this.gameloop) clearInterval(this.gameloop);
        this.game = game;
        //this.gameloop = setInterval(this.game.update.bind(this.game), this.game.config.tick_rate);
        return game;
    }

    // https://24ways.org/2010/calculating-color-contrast/
    getContrast50(hexcolor){
        return (parseInt(hexcolor, 16) > 0xffffff/2) ? 0x000000:0xffffff;
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
        window.addEventListener('resize', () => {
            this.app.renderer.resize(window.innerWidth - 25, window.innerHeight - 25);
            this.viewport.screenWidth = window.innerWidth - 25,
            this.viewport.screenHeight = window.innerHeight - 25;
        });
        document.body.appendChild(this.app.view);
        this.app.stage.on("mouseup", this.stopDrag);
        // this.app.view.style.opacity = 0;

        // TEXTURES
        this.texture_cache = {};

        // Nodes and bubbles
        let gfx = new PIXI.Graphics();
        gfx.lineStyle(10, 0xffffff);
        // gfx.beginFill(0xffffff);
        gfx.drawCircle(0, 0, 50);
        // gfx.endFill();
        this.texture_cache.circle_stroke = gfx.generateCanvasTexture();

        gfx = new PIXI.Graphics();
        gfx.beginFill(0xffffff);
        gfx.drawCircle(0, 0, 50);
        gfx.endFill();
        this.texture_cache.circle = gfx.generateCanvasTexture();

        gfx = new PIXI.Graphics();
        gfx.beginFill(0xffffff);
        gfx.drawCircle(0, 0, 10);
        gfx.endFill();
        this.texture_cache.circle_small = gfx.generateCanvasTexture();

        gfx = new PIXI.Graphics();
        gfx.lineStyle(2, 0xffffff);
        // gfx.beginFill(0xffffff);
        gfx.drawCircle(0, 0, 10);
        // gfx.endFill();
        this.texture_cache.circle_stroke_small = gfx.generateCanvasTexture();

        // Arrowhead
        gfx = new PIXI.Graphics();
        let tox = 0, toy = 0, headlen = renderConfig.arrowhead_size, angle = 0;
        gfx.clear();
        gfx.beginFill(0xffffff);
        gfx.moveTo(tox, toy);
        gfx.lineTo(tox-headlen*Math.cos(angle-Math.PI/6),toy-headlen*Math.sin(angle-Math.PI/6));
        gfx.lineTo(tox-headlen*Math.cos(angle+Math.PI/6),toy-headlen*Math.sin(angle+Math.PI/6));
        gfx.lineTo(tox, toy);
        gfx.endFill();
        this.texture_cache.arrowhead = gfx.generateCanvasTexture();

        // Viewport
        this.viewport = new Viewport({
            screenWidth: window.innerWidth - 25,
            screenHeight: window.innerHeight - 25,
            worldWidth: config.width * renderConfig.scale,
            worldHeight: config.height * renderConfig.scale
        }).drag()
            .wheel()
            .pinch()
            .decelerate()
            .clamp({left:true, right:true, top:true, bottom:true})
            .clampZoom({
                maxWidth:config.width*10,
                maxHeight:config.height*10,
                minWidth:config.width/3,
                minHeight:config.height/3
            })
            .moveCenter(config.width * renderConfig.scale / 2, config.height * renderConfig.scale / 2)
            .snapZoom({width: config.width*10, removeOnComplete:true});
        this.app.stage.addChild(this.viewport);

        // Layers
        this.viewport.addChild(this.edge_layer = new PIXI.Container());
        this.viewport.addChild(this.bubble_layer = new PIXI.Container());
        this.viewport.addChild(this.node_layer = new PIXI.Container());

        // Edges
        this.edge_layer.addChild(this.edgeGfx = new PIXI.Graphics());

        // Render Loop
        this.app.ticker.add(this.draw.bind(this));
    }

    createNodeSprite(node){
        let tex = node.isSource ? this.texture_cache.circle_stroke : this.texture_cache.circle,
            sprite = new PIXI.Sprite(tex);
        sprite.interactive = true;
        sprite.anchor.x = sprite.anchor.y = 0.5;
        sprite.on('mousedown', () => this.startDrag(node));
        sprite.on('mouseup', this.stopDrag.bind(this));
        sprite.on('mouseupoutside', this.stopDrag.bind(this));
        sprite.on('mouseover', () => { this.dragTo = node===this.dragFrom ? null : node; this.selectedNode = node; });
        sprite.on('mouseout', () => { this.dragTo = null; this.selectedNode = null; });
        this.node_layer.addChild(sprite);
        return sprite;
    }

    getTextColor(bg){
        return (bg > 0xffffff/2) ? '#000000':'#ffffff';
    }

    abbreviateNumber(value) {
        // var newValue = value;
        // if (value >= 1000) {
        //     var suffixes = ["", "k", "m", "b","t"];
        //     var suffixNum = Math.floor( (""+value).length/3 );
        //     var shortValue = '';
        //     for (var precision = 2; precision >= 1; precision--) {
        //         shortValue = parseFloat( (suffixNum != 0 ? (value / Math.pow(1000,suffixNum) ) : value).toPrecision(precision));
        //         var dotLessShortValue = (shortValue + '').replace(/[^a-zA-Z 0-9]+/g,'');
        //         if (dotLessShortValue.length <= 2) { break; }
        //     }
        //     if (shortValue % 1 != 0)  shortValue = shortValue.toFixed(1);
        //     newValue = shortValue+suffixes[suffixNum];
        // }
        // return newValue;
        return value.toString();
    }

    createNodeText(node){
        let style = new PIXI.TextStyle({
            fontFamily: 'Arial',
            fontSize: renderConfig.scale * 2,
            fill: '#ffffff' // TODO
        });
        let txt = new PIXI.Text("-1", style);
        txt.x = node.x * renderConfig.scale - renderConfig.scale / 2;
        txt.y = node.y * renderConfig.scale - renderConfig.scale / 2;
        txt.interactive = false;
        txt.scale.x = txt.scale.y = 0.5;
        this.node_layer.addChild(txt);
        return txt;
    }

    drawNode(node){
        // Sprite init
        if(!node.sprite) node.sprite = this.createNodeSprite(node);
        if(!node.text) node.text = this.createNodeText(node);

        // Viewport clipping
        let sprite = node.sprite,
            text = node.text,
            x = node.x * renderConfig.scale,
            y = node.y * renderConfig.scale,
            radius = node.radius * renderConfig.scale,
            zoomedIn = this.viewport.right - this.viewport.left < 5000;
        if(x < this.viewport.left - radius || x > this.viewport.right + radius || y < this.viewport.top - radius || y > this.viewport.bottom + radius){
            sprite.visible = false;
            text.visible = false;
            return;
        }
        if(!sprite.visible)
            sprite.visible = true;
        text.visible = zoomedIn;

        // LOD
        if(!zoomedIn && node.isSource && sprite.texture !== this.texture_cache.circle_stroke_small) sprite.texture = this.texture_cache.circle_stroke_small;
        else if(!zoomedIn && !node.isSource && sprite.texture !== this.texture_cache.circle_small) sprite.texture = this.texture_cache.circle_small;
        else if(zoomedIn && node.isSource && sprite.texture !== this.texture_cache.circle_stroke) sprite.texture = this.texture_cache.circle_stroke;
        else if(zoomedIn && !node.isSource && sprite.texture !== this.texture_cache.circle) sprite.texture = this.texture_cache.circle;

        // Update properties
        // console.log(node.owner);
        // console.log(this.game.players);
        // console.log(this.game.players[node.owner]);
        let color = this.game.players[node.owner].color,
            size = radius * 2,
            value = node.isSource ? '∞' : this.abbreviateNumber(node.bubbles),
            textColor = node.isSource ? color : this.getTextColor(color),
            metrics = PIXI.TextMetrics.measureText(value, text.style);
        if(sprite.tint !== color) sprite.tint = color;
        if(sprite.x !== x) sprite.x = x; // TODO could move this to createNodeSprite if desired...
        if(sprite.y !== y) sprite.y = y;
        if(sprite.width !== size) sprite.width = sprite.height = size;
        if(text.text !== value) text.text = value;
        if(text.x !== x - text.width / 2) text.x = x - metrics.width / 4; // text sprites are scaled down, and textmetrics doesn't reflect that
        if(text.y !== y - text.height / 2) text.y = y - metrics.height / 4;
        if(text.style.fill !== textColor) text.style.fill = textColor;
    }

    // Edges
    createEdgeSprite(edge){
        let sprite = new PIXI.Sprite(this.texture_cache.arrowhead);
        sprite.interactive = sprite.buttonmode = true;
        sprite.on('mousedown', () => this.startDrag(this.game.nodes[edge.from], this.game.nodes[edge.to]));
        sprite.on('mouseup', this.stopDrag.bind(this));
        sprite.on('mouseupoutside', this.stopDrag.bind(this));
        sprite.anchor.x = sprite.anchor.y = 0.5;
        this.edge_layer.addChild(sprite);
        return sprite;
    }
    
    drawEdge(edge){
        // Sprite lifecycle
        if(edge.dead && edge.sprite) edge.sprite.visible = false;
        if(edge.dead) return;
        if(!edge.sprite) edge.sprite = this.createEdgeSprite(edge);

        // DragMode
        let from = this.game.nodes[edge.from],
            to = this.game.nodes[edge.to],
            sprite = edge.sprite;
        if(this.dragFrom === from && this.dragToOld === to){
            sprite.visible = false;
            return;
        }
        if(!sprite.visible) sprite.visible = true;

        // Calculate position, angle, color
        let gfx = this.edgeGfx,
            color = (from.owner === to.owner) ? this.game.players[from.owner].color : 0x010101,
            dist = this.game.distance(from, to),
            delta_x = to.x - from.x,
            delta_y = to.y - from.y,
            to_ratio = to.radius / dist,
            from_ratio = from.radius / dist,
            fromx = (from.x + delta_x * from_ratio) * renderConfig.scale,
            fromy = (from.y + delta_y * from_ratio) * renderConfig.scale,
            tox = (to.x - delta_x * to_ratio) * renderConfig.scale,
            toy = (to.y - delta_y * to_ratio) * renderConfig.scale,
            angle = Math.atan2(toy-fromy,tox-fromx),
            maxEdge = this.game.config.max_edge * renderConfig.scale,
            thickness = this.viewport.right - this.viewport.left < 5000 ? renderConfig.line_thickness : 15;

        // Viewport clipping
        if(fromx < this.viewport.left - maxEdge || fromx > this.viewport.right + maxEdge || fromy < this.viewport.top - maxEdge || fromy > this.viewport.bottom + maxEdge ||
            tox < this.viewport.left - maxEdge || tox > this.viewport.right + maxEdge || toy < this.viewport.top - maxEdge || toy > this.viewport.bottom + maxEdge){
            sprite.visible = false;
            return;
        }

        // Arrowhead
        if(sprite.x !== tox) sprite.x = tox;
        if(sprite.y !== toy) sprite.y = toy;
        if(sprite.rotation !== angle) sprite.rotation = angle;
        if(sprite.tint !== color) sprite.tint = color;

        // Line
        gfx.lineStyle(thickness, color);
        gfx.moveTo(fromx, fromy);
        gfx.lineTo(tox, toy);
    }

    // Bubbles
    createBubbleSprite(bubble){
        let sprite = new PIXI.Sprite(this.texture_cache.circle);
        sprite.anchor.x = sprite.anchor.y = 0.5;
        sprite.interactive = false;
        this.bubble_layer.addChild(sprite);
        return sprite;
    }

    drawBubble(bubble, edge){
        // Sprite lifecycle
        if(!bubble.sprite) bubble.sprite = this.createBubbleSprite(bubble);
        if(bubble.dead)
            bubble.sprite.visible = false;
        else if(!bubble.dead && !bubble.sprite.visible)
            bubble.sprite.visible = true;
        if(bubble.dead) return;

        // Interpolate movement between grid squares
        let delta_time = Date.now() - this.game.last_update,
             tick_ratio = delta_time / this.game.config.tick_rate,
             interp_pos = bubble.pos + tick_ratio * this.game.config.bubble_radius;

        // Now convert distance on the node to (x, y)
        let sprite = bubble.sprite,
            gfx = bubble.graphics,
            from = this.game.nodes[edge.from],
            to = this.game.nodes[edge.to],
            edge_length = this.game.distance(from, to),
            pos_ratio = interp_pos / edge_length,
            delta_x = to.x - from.x,
            delta_y = to.y - from.y,
            x = (from.x + delta_x * pos_ratio) * renderConfig.scale,
            y = (from.y + delta_y * pos_ratio) * renderConfig.scale,
            radius = this.game.config.bubble_radius * renderConfig.scale,
            color = this.game.players[bubble.owner].color,
            size = radius * 2;
        
        // Viewport clipping
        // TODO slightly better to clip before all the calculations above
        if(x < this.viewport.left - radius || x > this.viewport.right + radius || y < this.viewport.top - radius || y > this.viewport.bottom + radius){
            sprite.visible = false;
            return;
        }
        if(this.viewport.right - this.viewport.left >= 5000){
            sprite.visible = false;
            return;
        }
        if(!sprite.visible)
            sprite.visible = true;

        // Update
        if(sprite.tint !== color) sprite.tint = color;
        if(sprite.x !== x) sprite.x = x;
        if(sprite.y !== y) sprite.y = y;
        if(sprite.width !== size) sprite.width = sprite.height = size;
    }

    // Drag
    drawDrag(){ // TODO this has some redudancy with drawEdge (ideally we should have a ghost Edge object that gets updated and rendered directly)
        // Sprite lifecycle
        if(!this.dragSprite) this.dragSprite = this.createEdgeSprite();
        let sprite = this.dragSprite;
        if(!this.dragFrom){
            sprite.visible = false;
            return;
        } else if (!sprite.visible)
            sprite.visible = true;
        
        let mouse = this.app.renderer.plugins.interaction.mouse.getLocalPosition(render.viewport),
            color = 0x010101,
            dist = this.game.distance({x: mouse.x / renderConfig.scale, y: mouse.y / renderConfig.scale}, this.dragFrom);
        if(dist > this.game.config.max_edge)
            color = 0xFF0000;

        // Stop arrow just before they get to a node
        let from = this.dragFrom,
            to = mouse,
            delta_x = to.x / renderConfig.scale - from.x,
            delta_y = to.y / renderConfig.scale - from.y,
            to_ratio,
            from_ratio = from.radius / dist,
            fromx = (from.x + delta_x * from_ratio) * renderConfig.scale,
            fromy = (from.y + delta_y * from_ratio) * renderConfig.scale,
            // fromx = from.x * renderConfig.scale,
            // fromy = from.y * renderConfig.scale,
            tox = mouse.x,
            toy = mouse.y,
            gfx = this.edgeGfx,
            angle = Math.atan2(toy-fromy,tox-fromx);

        console.log(delta_x, delta_y);

        // Snap to eligible nodes
        if(this.dragTo && !this.dragFrom.edges.find(a => a.to === this.dragTo.id && !a.dead && (this.dragToOld && a.to !== this.dragToOld.id)) && color !== 0xFF0000){
            // Redo calculations whee
            to = this.dragTo;
            dist = this.game.distance(from, to);
            delta_x = to.x - from.x;
            delta_y = to.y - from.y;
            to_ratio = to.radius / dist;
            tox = (to.x - delta_x * to_ratio) * renderConfig.scale;
            toy = (to.y - delta_y * to_ratio) * renderConfig.scale;
            color = (this.dragFrom.owner === this.dragTo.owner) ? this.game.players[this.dragFrom.owner].color : 0x010101;
            angle = Math.atan2(toy-fromy,tox-fromx);
        }

        // Arrowhead
        if(sprite.x !== tox) sprite.x = tox;
        if(sprite.y !== toy) sprite.y = toy;
        if(sprite.rotation !== angle) sprite.rotation = angle;
        if(sprite.tint !== color) sprite.tint = color;

        // Line
        gfx.lineStyle(renderConfig.line_thickness, color);
        gfx.moveTo(fromx, fromy);
        gfx.lineTo(tox, toy);
    }

    createSelectedNodeText(){
        let style = new PIXI.TextStyle({
            fontFamily: 'Arial',
            fontSize: renderConfig.scale,
            fill: '#707070'
        });
        let txt = new PIXI.Text("server", style);
        txt.scale.x = txt.scale.y = 0.5;
        // txt.x = node.x * renderConfig.scale - renderConfig.scale / 2;
        // txt.y = node.y * renderConfig.scale - renderConfig.scale / 2 - node.radius - 10;
        this.node_layer.addChild(txt);
        return txt;
    }

    // Selected Node
    drawSelectedNode(){
        if(!this.selectedNode) {
            if(this.selectedNodeTxt && this.selectedNodeTxt.visible) this.selectedNodeTxt.visible = false;
            return;
        }

        // Draw ghost edges
        this.game.getNeighbors(this.selectedNode).forEach(node => {
            if(this.selectedNode.edges.find(edge => edge.to === node.id && !edge.dead)) return; // Edge already exists!
            if(node.edges.find(edge => edge.to === this.selectedNode.id && !edge.dead)) return; // Edge already exists!
            if(node === this.dragFrom) return;

            let gfx = this.edgeGfx,
                color = 0xd6d6d6,
                thickness = 1,
                from = this.selectedNode,
                to = node,
                dist = this.game.distance(from, to),
                delta_x = to.x - from.x,
                delta_y = to.y - from.y,
                to_ratio = to.radius / dist,
                from_ratio = from.radius / dist,
                fromx = (from.x + delta_x * from_ratio) * renderConfig.scale,
                fromy = (from.y + delta_y * from_ratio) * renderConfig.scale,
                tox = (to.x - delta_x * to_ratio) * renderConfig.scale,
                toy = (to.y - delta_y * to_ratio) * renderConfig.scale,
                angle = Math.atan2(toy-fromy,tox-fromx);

            gfx.lineStyle(1, 0xd6d6d6)
                .moveTo(fromx, fromy)
                .lineTo(tox, toy);
        });

        // Draw owner name
        if(!this.selectedNodeTxt) this.selectedNodeTxt = this.createSelectedNodeText();
        let node = this.selectedNode,
            text = this.selectedNodeTxt,
            value = this.selectedNode.owner,
            metrics = PIXI.TextMetrics.measureText(value, text.style),
            x = node.x * renderConfig.scale - metrics.width / 4,
            y = (node.y - node.radius) * renderConfig.scale - metrics.height / 4 - 15,
            color = "#"+this.game.players[this.selectedNode.owner].color.toString(16);
        text.visible = this.viewport.right - this.viewport.left < 5000;
        if(text.x !== x) text.x = x;
        if(text.y !== y) text.y = y;
        if(text.text !== value) text.text = value;
        if(text.style.fill !== color) text.style.fill = color;
    }

    // Draw
    draw(){
        // try{
            this.edgeGfx.clear();
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
        // } catch(e) {
        //     console.error(e);
        // }
    }

    // Edge dragging
    startDrag(node, dragToOld=null){
        // console.log("Start edge drag");
        if(node.owner !== this.player) return false;

        this.viewport.pause = true;
        this.dragFrom = node;
        this.dragToOld = dragToOld;
    }

    stopDrag(){
        // TODO ugly nested logic...how to do this with guard clauses, or otherwise more intuitively?
        if(this.dragToOld && this.dragToOld === this.dragTo){
            this.viewport.pause = false;
            this.dragFrom = null;
            this.dragTo = null;
            this.dragToOld = null;
            return;
        }

        if(this.dragToOld)
            this.game.removeEdge(this.player, this.dragFrom.id, this.dragToOld.id);

        if(this.dragFrom !== null && this.dragTo !== null && !this.dragFrom.edges.find(a => a.to === this.dragTo.id && a.dead === false))
            this.game.createEdge(this.player, this.dragFrom.id, this.dragTo.id);


        this.viewport.pause = false;
        this.dragFrom = null;
        this.dragTo = null;
        this.dragToOld = null;
    }

}