class UI {
    constructor(client){
        this.client = client;
        client.ui = this;

        // Grab and cache dom instances
        this.dom = {};
        ["spawn", "name", "color", "error", "submit"].forEach(id => this.dom[id] = document.getElementById(id));

        this.dom.name.value = "Player"+chance.integer({min:0, max:999});
        this.dom.color.value = chance.integer({min: 0x00000, max:0xf0f0f0}).toString(16);
    }

    onConnect(){
        this.dom.submit.disabled = false;
    }

    onSpawn(){
        this.dom.spawn.style.display="none";
    }

    submitSpawn(){
        this.client.spawn(this.dom.name.value, this.dom.color.value);
        return false;
    }

    onSpawnFailed(error){
        this.dom.error.style.display="block";
        this.dom.error.innerHTML = error;
    }
}