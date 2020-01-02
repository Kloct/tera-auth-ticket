const request = require('request');
const log = require('log');
const logThis = log('tera-auth-ticket')

class webClient {
    constructor(email, password) {
        this.email = email
        this.password = password
        this.requestSpark = request.defaults({
            baseUrl: 'https://spark.gameforge.com/api/v1'
        })
        this.requestLogin = request.defaults({
            baseUrl: 'https://login.tera.gameforge.com/launcher'
        })
    }
    async getLogin(callback){
        try{
            let bearerToken = await this.getBearer();
            let account = await this.getAccounts(bearerToken);
            let mAuthCode = await this.getMAuthSession(bearerToken, account);
            let cookie = await this.loginMAuth(mAuthCode);
            let serverInfo = await this.getServerInfo(cookie);
            callback(null, {name: serverInfo.master_account_name, ticket: serverInfo.ticket})
        }
        catch(err){
            callback(err)
        }
    }
    getBearer(){
        return new Promise((resolve, reject)=>{
            this.requestSpark.post({
                url: '/auth/sessions',
                json: {
                    email: this.email,
                    password: this.password,
                    locale: 'en_GB'
                }
            }, (err, res, body)=>{
                if (err) reject(err);
                else if (body.token) {
                    logThis.log('Login Successfull!');
                    resolve(body.token);
                }
                else {
                    reject(`Could not login to Gameforge account! (${this.email})\n Please check that you have provided the correct email and password and that the account is not blocked.`);
                }
            })
        })
    }
    createAccount(bearer) {
        return new Promise((resolve, reject)=>{
            this.requestSpark.post({
                url: '/user/thin/accounts',
                auth: { bearer },
                json: {
                    platformGameId: '68f799ce-b2cf-44f5-8638-ce992d7fd0f4',
                    displayName: this.email.substring(0, this.email.indexOf('@')),
                    email: this.email,
                    gfLang: 'en',
                    region: '',
                    blackbox: null
                }
            }, (err, res, body)=>{
                if (err) reject(err);
                else {
                    resolve(body);
                }
            })
        })
    }
    getAccounts(bearer){
        return new Promise((resolve, reject)=>{
            this.requestSpark.get({
                url: '/user/accounts',
                auth: { bearer },
                json: true
            }, async (err, res, body)=>{
                if (err) reject(err);
                else {
                    let account = Object.values(body).find(a=>{
                        if (a.guls.game === 'tera'){
                            return true;
                        }
                    });
                    if (account) {
                        logThis.log(`Got account info: ${account.displayName} #${account.accountNumericId}`)
                        resolve(account);
                    } else {
                        logThis.log(`No TERA-EU account found. Creating one.`);
                        try {
                            await this.createAccount(bearer);
                            resolve(this.getAccounts(bearer));
                        } catch (err) {
                            reject(err);
                        }
                    }
                }
            })
        })
    }
    getMAuthSession(bearer, account){
        return new Promise((resolve, reject)=>{
            this.requestSpark.post({
                url: '/auth/thin/codes',
                json: { platformGameAccountId: account.id },
                auth: { bearer },
            }, (err, res, body)=>{
                if (err) reject(err);
                else resolve(body.code);
            })
        })
    }
    // thanks Mathicha (https://github.com/Mathicha/tera-auth-ticket-eu) for figuring out this last part of the login process
    loginMAuth(mauth_session){
        return new Promise((resolve, reject)=>{
            const j = request.jar()
            this.requestLogin.post({
                url: '/loginMAuth',
                form: { mauth_session, language: 'en'},
                json: true,
                jar: j
            }, (err, res, body)=>{
                if (err) reject(err);
                else if (res.statusCode === 403 ) reject('Account blocked, Please contact Support');
                else if (body && body.error) reject(body.error);
                else resolve(j);
            })
        })
    }
    getServerInfo(jar){
        return new Promise((resolve, reject)=>{
            this.requestLogin.get({
                url: '/getServerInfo',
                json: true,
                jar
            }, (err, res, body)=>{
                if(err) reject(err);
                else {
                    logThis.log('Got Ticket!')
                    resolve(body);
                }
            })
        })
    }
}
module.exports = webClient;