class UI {
    constructor(client){
        this.client = client;
        client.ui = this;

        // Grab and cache dom instances
        this.dom = {};
        ["spawn", "name", "color", "error", "submit"].forEach(id => this.dom[id] = document.getElementById(id));
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