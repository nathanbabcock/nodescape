class UI {
    constructor(client){
        this.client = client;
        client.ui = this;

        // Grab and cache dom instances
        this.dom = {};
        ["spawn", "name", "color", "error", "submit", "watermark", "register_modal","info_step", "paypal_step", "pending_step", "finish_step"]
            .forEach(id => this.dom[id] = document.getElementById(id));

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
        this.initAuth0();
        this.initStripe();
        // this.initPaypal();
    }

    initCarousel(){
        var flkty = new Flickity( '.main-carousel', {
            //autoPlay: 10000
        // options
        });
    }

    initAuth0(){
        this.register_modal = new Auth0Lock(
            'O6nD56ZYl6E9Njp5gXlYoTReaObvc240',
            'nodescape.auth0.com',
            {
              initialScreen: 'signUp',
              auth: {
                responseType: 'id_token token',
                redirect: false
              }
            }
        );
        this.register_modal.on('authenticated', (authResult) => {
            this.authResult = authResult;
            console.log(authResult);
            // login_inline.getUserInfo(authResult.accessToken, function(error, profile) {
            //     if (error) {
            //       // Handle error
            //       return;
            //     }
            //     console.log(profile);
            //     console.log(authResult);
            
            //     let user_id = authResult.idTokenPayload.sub.split("|")[1];
            //     console.log("user id", user_id);
            //     // console.log("nickname", profile.nickname);
            
            //     //localStorage.setItem('accessToken', authResult.accessToken);
            //     //localStorage.setItem('profile', JSON.stringify(profile));
            // });
            this.dom.info_step.style.display="none";
            this.dom.paypal_step.style.display="block";
            setTimeout(() => this.register_modal.hide(), 2000);
            setTimeout(this.openStripe.bind(this), 2500);
        });
    }

    initStripe(){
        this.stripe_handler = StripeCheckout.configure({
            key: 'pk_test_hZiLWCQbirV0dPG4vDnuhwQ2',
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
            name: 'NodeScape',
            description: 'Permanent membership',
            zipCode: true,
            amount: 500
        });
    }

    initPaypal(){
        paypal.Button.render({
            env: 'sandbox', // sandbox | production
      
            // PayPal Client IDs - replace with your own
            // Create a PayPal app: https://developer.paypal.com/developer/applications/create
            client: {
                sandbox:    'AUwaHya1Bdl37I9AlWCoXI20FrwTKipn3dx8zwc7LHM_XNS4qGdEB7hKFanc3y5H5fItNqL_QU677sl9',
                production: '<insert production client id>'
            },
      
            // Show the buyer a 'Pay Now' button in the checkout flow
            commit: true,
      
            // payment() is called when the button is clicked
            payment: (data, actions) => {
                setTimeout(()=>{
                    this.dom.paypal_step.style.display="none";
                    this.dom.pending_step.style.display="block";
                }, 1000);                

                // Make a call to the REST api to create the payment
                return actions.payment.create({
                    payment: {
                        transactions: [
                            {
                                amount: { total: '5.00', currency: 'USD' }
                            }
                        ]
                    }
                });

                
            },
      
            // onAuthorize() is called when the buyer approves the payment
            onAuthorize: (data, actions) => {
                console.log(data);

                this.client.send({
                    msgtype: "registerPermanent",
                    paymentID: data.paymentID,
                    payerID: data.payerID,
                    id_token: this.authResult.idToken
                });
      
                // Make a call to the REST api to execute the payment
                // return actions.payment.execute().then(function() {
                //     window.alert('Payment Complete!');
                // });
            }
      
        }, '#paypal_step');
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
    }
}