class UI {
    constructor(client){
        this.client = client;
        client.ui = this;

        // Grab and cache dom instances
        this.dom = {};
        ["spawn", "name", "color"].forEach(id => this.dom[id] = document.getElementById(id));
    }

    onSpawn(){
        document.getElementById("spawn").style.display="none";
    }

    submitSpawn(){
        this.client.spawn(this.dom.name.value, this.dom.color.value);
        return false;
    }
}