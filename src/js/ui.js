class UI {
    constructor(client){
        this.client = client;
        client.ui = this;

        // Grab and cache dom instances
        this.dom = {};
        ["spawn", "name", "color", "error", "submit", "watermark"].forEach(id => this.dom[id] = document.getElementById(id));

        this.dom.name.value = "Player"+chance.integer({min:0, max:999});
        let color = chance.integer({min: 0x00000, max:0xf0f0f0}).toString(16);
        this.dom.color.value = color;
        this.dom.name.style.color = `#${color}`;

        // OnBeforeUnload
        window.addEventListener("beforeunload", (e) => {
            // if(this.dom.watermark.style.display !== "block")
            //     return undefined;
            // TODO Modal message here?
            let msg = "All progress is lost when you close your tab. Continue?"
            e.returnValue = msg;
            return msg;
        });

        this.initCarousel();
    }

    initCarousel(){
        var flkty = new Flickity( '.main-carousel', {
            //autoPlay: 10000
        // options
        });
    }

    onConnect(){
        this.dom.submit.disabled = false;
    }

    onSpawn(){
        //this.dom.spawn.style.display="none";
        this.dom.spawn.style.top = "-725px";
        this.dom.watermark.style.display = "block";
    }

    submitSpawn(){
        this.client.spawn(this.dom.name.value, parseInt(this.dom.color.value, 16));
        return false;
    }

    onSpawnFailed(error){
        // this.dom.error.style.display="block";
        this.dom.error.innerHTML = error;
    }

    changeColor(jscolor){
        this.dom.name.style.color = `#${jscolor}`;
    }
}