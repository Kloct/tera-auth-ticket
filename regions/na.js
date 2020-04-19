const axios = require('axios');
const log = require('log');
const qs = require('qs');
const logThis = log('tera-auth-ticket');
const snare = require('../snare');

function makeHeaders(o) {
    return Object.assign({
        'Host': 'account.enmasse.com',
        'Connection': 'keep-alive',
        'Accept': 'application/json, text/plain, */*',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/47.0.2526.80 Safari/537.36',
        'Referer': 'https://launcher.enmasse.com/index2.html',
        'Accept-Encoding': 'gzip, deflate',
        'Accept-Language': 'en-US,en;q=0.8'
    }, o);
}

class webClient {
    constructor(email, password) {
        this.email = email;
        this.password = password;
        this.axios = axios.create({
            baseURL: 'https://account.enmasse.com'
        });
        this.headers = makeHeaders();
    }
    async getLogin(){
        // Login to AMS
        let { data: accessToken } = await this.axios.post('/oauth/token', {
                "client_id":"f6311c6fe35e1feeab86446c1e8047df0afeffac2a8a2382c51e1129a842b1e0",
                "client_secret":"76950a6dd11e12b7a53f6c03f4e195a93fd791bb6acd1dbd2c636322fd3da6f8",
                "grant_type":"password",
                "password":this.password,
                "scope":"public",
                "username":this.email
            }, {headers: this.headers})
            .catch(err=>{
                if (err.response.status===401) throw 'Invalid email or password!'
                else throw err
            });
        logThis.log('Received Access Token!');
        this.headers = makeHeaders({Authorization: `Bearer ${accessToken.access_token}`});
        // Get Account Information
        let { data: accountInfo } = await this.axios.get('/api/public/launcher_v3/user_game_accounts', {headers: this.headers});
        logThis.log(`Account Info: (Account Name: ${accountInfo.info.other.screen_name}, Account Id: ${accountInfo.info.custom[0].id})`);
        // Get Auth Token
        let blackbox = await getBlackbox()
        let data = {
            'game_id': 1,
            'game_account_id': accountInfo.info.custom[0].id,
            'user': `{"io_black_box": "${blackbox}"}`
        }
        let { data: authToken } = await this.axios.get(`/api/public/launcher_v3/tera_support/check_iovation_and_request_auth_token?${qs.stringify(data)}`, {headers: this.headers})
        return {name: accountInfo.info.other.screen_name, ticket: authToken.auth_token};
    }
}
function getBlackbox(){
    return new Promise((resolve, reject)=>{
        snare((err, blackbox)=>{
            if (err) reject(err)
            resolve(blackbox)
        })
    })
}

module.exports = webClient;