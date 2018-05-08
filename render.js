// Render Config
const renderConfig = {
    grid_size: 25,
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
        this.gameloop = setInterval(this.game.update.bind(this.game), 1000);
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
        this.viewport.addChild(this.lane_layer = new PIXI.Container());
        this.viewport.addChild(this.base_layer = new PIXI.Container());
        this.viewport.addChild(this.creep_layer = new PIXI.Container());
        this.viewport.addChild(this.tower_layer = new PIXI.Container());
        this.viewport.addChild(this.anim_layer = new PIXI.Container());
    }

}

