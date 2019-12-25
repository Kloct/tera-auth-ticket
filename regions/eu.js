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
                else {
                    logThis.log('Login Successfull!');
                    resolve(body.token);
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
            }, (err, res, body)=>{
                if (err) reject(err);
                else {
                    Object.values(body).forEach(a=>{
                        if (a.guls.game === 'tera'){
                            logThis.log(`Got account info: ${a.displayName} #${a.accountNumericId}`)
                            resolve(a);
                        }
                    })
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
                else if (body.error) reject(body.error);
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