const // Require
    request = require("request-promise-native"),
    jwt = require("jsonwebtoken"),
    jwks = require('jwks-rsa'),
    stripe = require('stripe')("sk_test_8WYNUBe0eH9ui5Qic7qPdIpI");

const // Config
    AUTH0_API = 'https://nodescape.auth0.com',
    PAYPAL_CLIENT = 'AUJoKVGO3q1WA1tGgAKRdY6qx0qQNIQ6vl6D3k7y64T4qh5WozIQ7V3dl3iusw5BwXYg_T5FzLCRguP8',
    PAYPAL_SECRET = 'EOw8LNwDhM7esrQ3nHfzKc7xiWnJc83Eawln4YLfUgivfx1LGzu9Mj0F5wlarilXDqdK9Q5aHVo-VGjJ',
    PAYPAL_API = 'https://api.sandbox.paypal.com';

class APIConnector {
    constructor(){
        this.api_token = null;
    }

    getAuth0Token() {
        if(this.api_token !== null && new Date().getTime() <= this.api_token.expiration){
            console.log("Using cached Auth0 token");
            return Promise.resolve(this.api_token);
        }
    
        console.log("Retrieving new API token from auth0");
        var options = {
            method: 'POST',
            url: `${AUTH0_API}/oauth/token`,
            headers: { 'content-type': 'application/json' },
            body: {
                grant_type: 'client_credentials',
                client_id: 'VaNSX65ch6zkA48jVlA6LLS3c6Aaizd6',
                client_secret: 'Px9kznexL52MSOi7fXug4v_zl2ohksztxJGFI8ENil7sL8GrkT6oQrnq1jkFHoNW',
                audience: `${AUTH0_API}/api/v2/`
            },
            json: true };
    
        return request(options)
            .then(result => {
                console.log("Received Auth0 API access token");
                result.expiration = new Date().getTime() + result.expires_in;
                this.api_token = result;
            });
    }

    // registerPermanent(id_token, playername, paymentID, payerID){
    //     return this.auth0RegisterPlayer(id_token, playername)
    //         .then(this.paypalExecutePayment(paymentID, payerID));
    // }
    
    auth0RegisterPlayer(id_token, playername){
        console.log("Connecting Auth0 user account to nodescape game player instance");
        return this.getAuth0Token().then(() => {
            var client = jwks({jwksUri: `${AUTH0_API}/.well-known/jwks.json`});
            function getKey(header, callback){
                client.getSigningKey(header.kid, function(err, key) {
                    var signingKey = key.publicKey || key.rsaPublicKey;
                    callback(null, signingKey);
                });
            }
        
            return new Promise((resolve, reject) => {
                jwt.verify(id_token, getKey, {}, (err, decoded) => {
                    if(err === null)
                        return resolve(decoded.sub);
                    return reject(err);
                });
            })
        }).then(user_id => {
            console.log("user_id", user_id);
            console.log("Updating user_metdata with Auth0 API");
            return request({
                method: 'PATCH',
                url: `${AUTH0_API}/api/v2/users/${user_id}`,
                headers: {
                    authorization: `Bearer ${this.api_token.access_token}`,
                    'content-type': 'application/json'
                },
                body: { "user_metadata": { "player_name": playername } },
                json: true
            });
        }).then(response => {
            console.log(response);
        });
    }

    stripeExecutePayment(token){
        return stripe.charges.create({
            amount: 500,
            currency: 'usd',
            description: 'Permanent membership',
            source: token,
        });
    }

    paypalExecutePayment(paymentID, payerID){
        console.log("Executing paypal payment");
        return request.post(PAYPAL_API + '/v1/payments/payment/' + paymentID + '/execute', {
            auth: {
              user: PAYPAL_CLIENT,
              pass: PAYPAL_SECRET
            },
            body: {
              payer_id: payerID,
              transactions: [{
                amount: {
                  total: '5.00',
                  currency: 'USD'
                }
              }]
            },
            json: true
        }).then((res) => {
            console.log(res);
        });
    }
}

// Node
if(typeof module !== "undefined")
    module.exports = APIConnector;