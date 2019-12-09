const request = require('request');
const log = require('log');
const logThis = log('tera-auth-ticket')

function makeHeaders(o) {
    return Object.assign({
        'Host': 'account.enmasse.com',
        'Connection': 'keep-alive',
        'Accept': 'application/json, text/plain, */*',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/47.0.2526.80 Safari/537.36',
        'Referer': 'https://launcher.enmasse.com/index2.html',
        'Accept-Encoding': 'gzip, deflate',
        'Accept-Language': 'en-US,en;q=0.8'
    }, o)
}
//error handling for JSON parse
function parseBody(body, callback) {
    let data;
    try {
        data = JSON.parse(body);
    }
    catch(e) {
        logThis.error(body);
        logThis.error(e);
        return callback('JSON parse error');
    }
    return data;
}

class webClient {
    constructor(email, password) {
        this.email = email;
        this.password = password;
        this.request = request.defaults({
            baseUrl: 'https://account.enmasse.com',
            headers: makeHeaders(),
        })
    }
    async getLogin(callback){
        let accessToken = await this.getOauth(callback);
        let accountInfo = await this.getUserId(accessToken, callback);
        let authToken = await this.getAuthTicket(accessToken, accountInfo.id, callback)
        callback(null, {name: accountInfo.name, ticket: authToken})
    }
    getOauth(callback){
        return new Promise((resolve)=>{
            this.request.post({
                url: '/oauth/token',
                formData: {
                    "client_id":"f6311c6fe35e1feeab86446c1e8047df0afeffac2a8a2382c51e1129a842b1e0",
                    "client_secret":"76950a6dd11e12b7a53f6c03f4e195a93fd791bb6acd1dbd2c636322fd3da6f8",
                    "grant_type":"password",
                    "password":this.password,
                    "scope":"public",
                    "username":this.email
                }
            }, (err, res)=>{
                if (err) {
                    logThis.error(err)
                    return callback('failed to get oauth token')
                }
                else {
                    let body = parseBody(res.body, callback)
                    if (body.error === "invalid_grant"){
                        logThis.error('Invalid email or password!')
                        return callback('failed to get oauth token')
                    }
                    else {
                        logThis.log('Received Access Token!')
                        resolve(body.access_token)
                    }
                }
            });
        })
    }

    // get user account id and name
    getUserId(bearerToken, callback){
        return new Promise ((resolve)=>{
            this.request({
                url: '/api/public/launcher_v3/user_game_accounts',
                headers: makeHeaders({
                    'Authorization': `Bearer ${bearerToken}`
                })

            }, (err, res)=>{
                if (err) {
                    logThis.error(err)
                    return callback('failed to get account info')
                }
                else {
                    let body = parseBody(res.body, callback)
                    let accountInfo = {
                        "id": body.info.custom[0].id,
                        "name": body.info.other.screen_name
                    }
                    logThis.log(`Account Info: (Account Name: ${accountInfo.name}, Account Id: ${accountInfo.id})`)
                    resolve(accountInfo)
                }
            })
        })
    }
    getAuthTicket(accessToken, accountId, callback){
        return new Promise ((resolve)=>{
            this.request({
                url: `/api/public/launcher_v3/tera_support/request_auth_token/${accountId}`,
                headers: makeHeaders({
                    'Authorization': `Bearer ${accessToken}`
                })
            }, (err, res)=>{
                if (err) {
                    logThis(err)
                    return callback('failed to get auth ticket')
                }
                else {
                    let body = parseBody(res.body, callback)
                    logThis.log('Got Auth Ticket!')
                    resolve(body.auth_token)
                }
            })
        })
    }
}

module.exports = webClient;