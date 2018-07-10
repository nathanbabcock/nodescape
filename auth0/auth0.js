// Require
const request = require("request-promise-native"),
    jwt = require("jsonwebtoken"),
    jwks = require('jwks-rsa');

// Config
const API_URL = 'https://nodescape.auth0.com';

// Global
let api_token = null;

// Input
let id_token = "eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiIsImtpZCI6Ik1qSXlPVVV5TXpSR01USTBRa0kyTWtOQk5rWkVNelV5UTBRek5ERkNOMFV6UlVKRk4wWTRSUSJ9.eyJuaWNrbmFtZSI6Im5hdGhhbi5yLmJhYmNvY2siLCJuYW1lIjoibmF0aGFuLnIuYmFiY29ja0BnbWFpbC5jb20iLCJwaWN0dXJlIjoiaHR0cHM6Ly9zLmdyYXZhdGFyLmNvbS9hdmF0YXIvM2M4NmMxYjBkMjg4ZTc1ZDc5ZmU3MTE0ODg1ZGQyZmM_cz00ODAmcj1wZyZkPWh0dHBzJTNBJTJGJTJGY2RuLmF1dGgwLmNvbSUyRmF2YXRhcnMlMkZuYS5wbmciLCJ1cGRhdGVkX2F0IjoiMjAxOC0wNy0wNlQyMDozOToyMi4yNTFaIiwiZW1haWwiOiJuYXRoYW4uci5iYWJjb2NrQGdtYWlsLmNvbSIsImVtYWlsX3ZlcmlmaWVkIjp0cnVlLCJpc3MiOiJodHRwczovL25vZGVzY2FwZS5hdXRoMC5jb20vIiwic3ViIjoiYXV0aDB8NWIzZTQ3YzJhMTc3YWMxOTY1ZmFlYWIzIiwiYXVkIjoiTzZuRDU2WllsNkU5TmpwNWdYbFlvVFJlYU9idmMyNDAiLCJpYXQiOjE1MzEyNDQwMDAsImV4cCI6MTUzMTI4MDAwMCwiYXRfaGFzaCI6IlNTRmdYREJlWER3cXZCUU5ZSllXMlEiLCJub25jZSI6ImxmSTlrYTM5Rk9uSTlYSU9DLWVtY3RYcVhnZ34zenZZIn0.Yh2RzuVoYfnk-qgDu09A4qPBgiOXJUszdm_eFWZyhu3xpHtrwqLpwG9rsZBahFnnIYrmOpdK8Xfn5rCdpyAjD3EL1dHTBuKdBw0G4fP9ViRxQcIs4j5PGETVGXx0Hu0vnBvaRYW_xHxfjg3kj5YG-sx9sgcoyueRRtDAYVsVNy0kgSyR32un3ZUQze1090plZv4iIfY-uD3B2HTV8TtDHtoVCDUfyP7FtRh1XNSPEC2o7XYmyRipUt4ar8bTg2FQc68iKcOmYCnx434qvHq5C4FH43qruOU5teqO955-L_Loy1FiOmy30CW4kFcpNhOvGqZkQ3kF2qptrb48GoxeUw";

function getToken() {
    if(api_token !== null && new Date().getTime() <= api_token.expiration){
        console.log("Using cached Auth0 token");
        return Promise.resolve(api_token);
    }

    console.log("Retrieving new API token from auth0");
    var options = {
        method: 'POST',
        url: `${API_URL}/oauth/token`,
        headers: { 'content-type': 'application/json' },
        body: {
            grant_type: 'client_credentials',
            client_id: 'VaNSX65ch6zkA48jVlA6LLS3c6Aaizd6',
            client_secret: 'Px9kznexL52MSOi7fXug4v_zl2ohksztxJGFI8ENil7sL8GrkT6oQrnq1jkFHoNW',
            audience: `${API_URL}/api/v2/`
        },
        json: true };

    return request(options)
        .then(result => {
            console.log("Received Auth0 API access token");
            result.expiration = new Date().getTime() + result.expires_in;
            api_token = result;
        });
}

getToken().then(() => {
    var client = jwks({jwksUri: `${API_URL}/.well-known/jwks.json`});
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
// }).then(user_id => {
//     console.log("user_id", user_id);
//     console.log("Updating user_metdata with Auth0 API");
//     return request({
//         method: 'PATCH',
//         url: `${API_URL}/api/v2/users/${user_id}`,
//         headers: {
//             authorization: `Bearer ${api_token.access_token}`,
//             'content-type': 'application/json'
//         },
//         body: { "user_metadata": { "player_name": "excalo" } },
//         json: true
//     });
// }).then(response => {
//     console.log(response);
}).then(user_id => {
    console.log("user_id", user_id);
    console.log("Getting user from Auth0 API");
    return request({
        method: 'GET',
        url: `${API_URL}/api/v2/users/${user_id}?fields=user_metadata`,
        headers: {
            authorization: `Bearer ${api_token.access_token}`,
            'content-type': 'application/json'
        },
        json: true
    });
}).then(response => {
    console.log(response);
}).catch(err => {
    console.error(err.message);
});

