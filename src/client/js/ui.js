class UI {
    constructor(client){
        this.client = client;
        client.ui = this;

        // Grab and cache dom instances
        this.dom = {};
        ["spawn", "name", "color", "error", "submit", "watermark", "watermark_embed", "register_modal","info_step", "pending_step", "finish_step", "topbar", "topbar_username", "topbar_permanent", "topbar_register", "topbar_color", "topbar_loading", "topbar_username_input", "topbar_error"]
            .forEach(id => this.dom[id] = document.getElementById(id));

        this.dom.name.value = "Player"+chance.integer({min:0, max:999});
        let color = chance.integer({min: 0x00000, max:0xf0f0f0}).toString(16);
        this.dom.color.value = color;
        this.dom.name.style.color = `#${color}`;

        // OnBeforeUnload
        setTimeout(() => window.addEventListener("beforeunload", (e) => {
            if(this.client.render.player === null || this.client.game.players[this.client.render.player].permanent)
                return null;

            let msg = "All progress is lost when you close your tab. Continue?"
            e.returnValue = msg;
            this.showRegisterModal();
            return msg;
        }), 0);
        

        this.initTopBar();
        this.initCarousel();
        this.initAuth0();
        this.initStripe();
        // this.initPaypal();
    }

    initTopBar(){
        // Topbar username
        let input = this.dom.topbar_username_input;
        let handler = ()=>{
                this.client.send({
                    msgtype:'changeName',
                    username:input.value
                });
                this.dom.topbar_username.innerHTML = input.value;
                input.style.display="none";
                this.dom.topbar_username.style.display = 'inline';
            };
        input.addEventListener('focusout', handler);
        input.addEventListener('keypress', (keypress) => {
            if(keypress.key === 'Enter'){
                this.dom.topbar_username.innerHTML = input.value;
                input.style.display="none";
                this.dom.topbar_username.style.display = 'inline';
            }
                //handler();
        });
    }

    initCarousel(){
        var flkty = new Flickity( '.main-carousel', {
            //autoPlay: 10000
        // options
        });
    }

    initAuth0(){
        // REGISTER
        this.register_modal = new Auth0Lock(
            'O6nD56ZYl6E9Njp5gXlYoTReaObvc240',
            'nodescape.auth0.com',
            {
                initialScreen: 'signUp',
                allowLogIn: false,
                auth: {
                    responseType: 'id_token token',
                    redirect: false
                },
                languageDictionary: {
                    title: 'NodeScape'
                },
                theme: {
                    logo: 'img/logo.png'
                }
            }
        );
        this.register_modal.on('authenticated', (authResult) => {
            this.authResult = authResult;
            console.log(authResult);
            this.dom.info_step.style.display="none";
            this.dom.pending_step.style.display="block";
            setTimeout(() => this.register_modal.hide(), 2000);
            setTimeout(this.openStripe.bind(this), 2500);
        });

        // LOGIN
        this.login_modal = new Auth0Lock(
            'O6nD56ZYl6E9Njp5gXlYoTReaObvc240',
            'nodescape.auth0.com',
            {
              allowSignUp: false,
              auth: {
                responseType: 'id_token token',
                redirect: false
              },
              languageDictionary: {
                  title: 'NodeScape'
              },
              theme: {
                logo: 'img/logo.png'
              }
            }
        );
        this.login_modal.on('authenticated', (authResult) => {
            // this.authResult = authResult;
            console.log(authResult);
            
            this.client.send({
                msgtype: 'login',
                id_token: authResult.idToken
            });

            setTimeout(() => this.login_modal.hide(), 2000);
        });
    }

    initStripe(){
        this.stripe_handler = StripeCheckout.configure({
            key: 'pk_live_ZS6TVvxmyHkkgEEg42BCSfRg',
            image: 'https://stripe.com/img/documentation/checkout/marketplace.png',
            locale: 'auto',
            token: (token) => {
                console.log('token', token);
                this.client.send({
                    msgtype: "registerPermanent",
                    stripe_token: token.id,
                    id_token: this.authResult.idToken
                });
              // You can access the token ID with `token.id`.
              // Get the token ID to your server-side code for use.
            }
        });
    }

    openStripe(){
        this.stripe_handler.open({
            email: this.authResult.idTokenPayload.email,
            image: 'img/logo.png',
            name: 'NodeScape',
            description: 'Permanent membership',
            zipCode: true,
            amount: 500,
            allowRememberMe: false,
            //closed: (test) => console.log("closed", test),
        });
    }

    onConnect(){
        this.dom.submit.disabled = false;
    }

    onSpawn(){
        //this.dom.spawn.style.display="none";
        // document.title = `NodeScape Beta (${this.client.render.player})`;
        this.dom.spawn.style.top = "-725px";
        if(window.self === window.top)
            this.dom.watermark.style.display = "block";
        else
            this.dom.watermark_embed.style.display = "block";
        this.dom.topbar.style.display = "block";
        this.dom.topbar_error.style.display = "block";
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

    changeTopbarColor(jscolor){
        this.dom.topbar_username.style.color = `#${jscolor}`;
        this.dom.topbar_username_input.style.color = `#${jscolor}`;
    }

    showRegisterModal(){
        if(this.dom.spawn.offsetTop > 0)
            this.dom.spawn.style.top = "-725px";
        if(this.dom.register_modal.offsetTop < 0)
            this.dom.register_modal.style.top = "50%";
    }

    closeModal(modal){
        var elem;
        if (typeof modal === 'string' || modal instanceof String)
            elem = document.querySelector(modal);
        else
            elem = modal;
        elem.style.top = `-${elem.clientHeight+25}px`;
    }

    openModal(modal){
        var elem;
        if (typeof modal === 'string' || modal instanceof String)
            elem = document.querySelector(modal);
        else
            elem = modal;
        elem.style.top = "50%";
    }

    showAuth0Register(){
        //this.closeModal(this.dom.register_modal);
        this.register_modal.show();
    }

    onRegisterSuccess(){
        this.dom.pending_step.style.display="none";
        this.dom.finish_step.style.display="block";
        this.dom.topbar_permanent.style.display="inline-block";
        this.dom.topbar_register.style.display="none";
    }

    showLogin(){
        this.login_modal.show();
    }

    changeName(){
        //prompt("Change username:", this.client.player);
        this.dom.topbar_username.style.display="none";
        this.dom.topbar_username_input.style.display="inline-block";
        this.dom.topbar_username_input.focus();
    }

    sendChangeColor(string){
        console.log(`Changing color to #${string}`);
        client.send({
            msgtype: 'changeColor',
            color:parseInt(string, 16),
        });
        this.dom.topbar_loading.style.display = "block";
        //`#${jscolor}`;
    }

    showTopBarError(error){
        this.dom.topbar_error.innerHTML = error;
        if(this.dom.topbar_error.clientTop > 0) clearTimeout(this.topbarTimeout);
        this.dom.topbar_error.style.top = "50px";
        this.topbarTimeout = setTimeout(()=>this.dom.topbar_error.style.top = "0", 6000);
    }
}