const axios = require('axios');
const querystring = require('querystring');
const log = require('log');
const logThis = log('tera-auth-ticket')

class webClient {
    constructor(email, password, account) {
        this.email = email;
        this.password = password;
        this.account = account;
        this.axiosSpark = axios.create({
            baseURL: 'https://spark.gameforge.com/api/v1'
        });
        this.axiosLogin = axios.create({
            baseURL: 'https://login.tera.gameforge.com/launcher'
        });
        this.headers = {};
    }
    async getLogin(){
        // Login to AMS
        let { data: accessToken } = await this.axiosSpark.post('/auth/sessions', {
                "email": this.email,
                "password": this.password,
                "locale": 'en_GB'
            })
            .catch(err=>{
                if (err.response.status===403) throw 'Invalid email or password!'
                else throw err
            });
        logThis.log('Received Access Token!');
        this.headers = {Authorization: `Bearer ${accessToken.token}`}; 
        // Account Info
        let account = await this.getAccountInfo();
        logThis.log(`Account Info: (Account Name: ${account.displayName}, Account Id: ${account.accountNumericId})`);
        // MAuth Code
        let { data: mAuth } = await this.axiosSpark.post('/auth/thin/codes', {platformGameAccountId: account.id}, {headers: this.headers});
        // Cookie
        let cookie = await this.axiosLogin.post('/loginMAuth', querystring.stringify({mauth_session:mAuth.code, language: 'en' }), {headers: { 'content-type': 'application/x-www-form-urlencoded'}} )
            .catch(err=>{
                if(err.response.status === 403) throw 'Account blocked, Please contact Support';
                else throw err;
            });
        this.headers = {Cookie: cookie.headers["set-cookie"][1]};
        // Auth Token
        let { data: serverInfo } = await this.axiosLogin.get('/getServerInfo', {headers: this.headers});
        return {name: serverInfo.master_account_name, ticket: serverInfo.ticket};
    }

    async getAccountInfo() {
        let { data: accounts } = await this.axiosSpark.get('/user/accounts', {headers: this.headers});
        let teraAccounts = Object.values(accounts).filter(a=>a.guls.game==='tera');
            if (teraAccounts.length) { // Check for tera account
                if (this.account) { // Use predefined account
                    return teraAccounts.filter(a=>a.displayName===this.account)[0];
                } else return teraAccounts[0];
            } else {
                logThis.log(`No TERA-EU account found. Creating one.`);
                await this.axiosSpark.post('/user/thin/accounts', {
                    "platformGameId": '68f799ce-b2cf-44f5-8638-ce992d7fd0f4',
                    "displayName": this.email.substring(0, this.email.indexOf('@')),
                    "email": this.email,
                    "gfLang": 'en',
                    "region": '',
                    "blackbox": null
                }, {headers: this.headers});
                return this.getAccountInfo();
            }
    }
}
module.exports = webClient;
