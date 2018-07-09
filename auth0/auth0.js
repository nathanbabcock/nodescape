const request = require("request-promise-native");

let api_token = null;



function getToken() {
    if(api_token !== null && new Date().getTime() <= api_token.expiration){
        console.log("Using cached Auth0 token");
        return Promise.resolve(api_token);
    }

    console.log("Retrieving new API token from auth0");
    var options = { method: 'POST',
        url: 'https://nodescape.auth0.com/oauth/token',
        headers: { 'content-type': 'application/json' },
        body: 
        { grant_type: 'client_credentials',
            client_id: 'VaNSX65ch6zkA48jVlA6LLS3c6Aaizd6',
            client_secret: 'Px9kznexL52MSOi7fXug4v_zl2ohksztxJGFI8ENil7sL8GrkT6oQrnq1jkFHoNW',
            audience: 'https://nodescape.auth0.com/api/v2/' },
        json: true };

    return request(options)
        .then(result => {
            console.log("res", result);
            result.expiration = new Date().getTime() + result.expires_in;
            api_token = result;
        })
        .catch(err => {
            console.error("err", err.message);
        });
}

getToken().then(() => {
    console.log("done");
});

