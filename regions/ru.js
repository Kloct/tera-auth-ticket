const request = require('request');
const log = require('log');
const logThis = log('tera-auth-ticket');
const util = require('util');

function makeHeadersDestiny(o) {
    return Object.assign({},
        {
            'Host': 'id.ddestiny.ru',
            'Connection': 'keep-alive',
            'Accept-Encoding': 'gzip,deflate',
            'Accept-Language': 'en-us,en;q=0.8',
            'User-Agent': 'Mozilla/5.0 (Windows NT 6.2; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/33.0.1750.170 Safari/537.36'
        },
        o
    );
}
function makeHeadersLauncher(o) {
    return Object.assign({},
        {
            'Host': 'launcher.tera-online.ru',
            'Connection': 'keep-alive',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'User-Agent': 'Mozilla/5.0 (Windows NT 6.2; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/33.0.1750.170 Safari/537.36',
            'Referer': 'http://launcher.tera-online.ru/launcher/',
            'Accept-Encoding': 'gzip,deflate',
            'Accept-Language': 'en-us,en;q=0.8'
        },
        o
    );
}

// TODO: add a process that actually resolves some of these automatically
let failedToLoginError = `Failed to login!\nThis is usually caused by one of three things:
    1) An Incorrect Username or Password
        Check your provided email and password'

    2) There is a captcha in place after too many login attempts from this location
        You can complete the captcha on the official launcher with this ip and wait 10 minutes for this issue to resolve automatically

    3) You are logging in from a new location and are required to authenticate with 2FA sent to your email
        Complete this process once on the official launcher with this ip to proceeed\n`

class webClient {
    constructor(email, password) {
        this.email = email
        this.password = password
        this.destinyCookie = request.jar()
        this.requestDestiny = request.defaults({
            baseUrl: 'https://id.ddestiny.ru',
            headers: makeHeadersDestiny(),
            jar: this.destinyCookie
        })
        this.launcherCookie = request.jar()
        this.requestLauncher = request.defaults({
            baseUrl: 'http://launcher.tera-online.ru',
            headers: makeHeadersLauncher(),
            jar: this.launcherCookie
        })
    }

    async getLogin(callback){
        try {
            let login = await this.destinyLogin();
            logThis.log(login)
            let OAuth = await this.launcherOAuth();
            logThis.log(OAuth.msg)
            let OTP = await this.getOTP();
            logThis.log(OTP.msg)
            callback(null, {name: OAuth.name, ticket: OTP.ticket})
        }
        catch(e) {
            callback(e)
        }
    }

    destinyLogin(){
        return new Promise((resolve, reject)=>{
            // get destinyid session ID
            this.requestDestiny({ url: `/bar/?project=tera` }, (err, res, body)=>{
                if(err) reject(new Error('Failed to get Destiny session ID!'))

                // get destinyid csrf token
                this.requestDestiny({ url: `/bar/popup/login/` }, (err, res, body)=>{
                    if(err) reject(new Error('Failed to get Destiny csrf token!'))
                    let oldCSRF = this.destinyCookie.getCookies('https://id.ddestiny.ru/bar/popup/login/')[1].value


                    // login
                    this.requestDestiny.post({ 
                        url: '/bar/popup/login/',
                        headers: makeHeadersDestiny({
                            'Referer': 'https://id.ddestiny.ru/bar/popup/login/'
                        }),
                        form: {
                            csrfmiddlewaretoken: this.destinyCookie.getCookies('https://id.ddestiny.ru/bar/popup/login/')[1].value,
                            username: this.email,
                            password: this.password
                        }
                    }, (err, res, body)=>{
                        let newCSRF = this.destinyCookie.getCookies('https://id.ddestiny.ru/bar/popup/login/')[1].value
                        if(oldCSRF===newCSRF) reject(failedToLoginError) // Going to take a lot of effort to fix some of these errors :/
                        if (err) reject(new Error('Error at Login!'));
                        resolve('DestinyId login completed');
                    })
                })
            })
        })
    }
    // Yucky callback tree
    launcherOAuth(){
        return new Promise((resolve, reject)=>{

            //oauth start
            this.requestLauncher({ url: '/login/destinyid/?next=http%3A%2F%2Flauncher.tera-online.ru%2Flauncher%2F%3Fosid%3D4105790410', followRedirect: false }, (err, res, body)=>{
                if(err) reject(new Error('Failed to start OAuth!'));

                //oauth authorize
                this.requestDestiny({ url: res.headers.location.slice(22), followRedirect: false }, (err, res, body)=>{
                    if(err) reject(new Error('OAuth failed to authorize!'));

                    //oauth confirm
                    this.requestDestiny({ url: '/oauth2/authorize/confirm', followRedirect: false }, (err, res, body)=>{
                        if(err) reject(new Error('OAuth authorization confirm failed!'));

                        //oauth redirect
                        this.requestDestiny({ url: '/oauth2/redirect', followRedirect: false }, (err, res, body)=>{
                            if(err) reject(new Error('Failed to redirect after OAuth!'));

                            // launcher complete
                            this.requestLauncher({ url: res.headers.location.slice(30), followRedirect: false }, (err, res, body)=>{
                                if(err) reject(new Error('Failed to follow OAuth redirect!'));
                                try{
                                    resolve({msg: `OAuth complete (Account: #${res.headers['x-accel-userid']})`, name: res.headers['x-accel-userid']});
                                }
                                catch(e){
                                    reject(new Error('OAuth has failed'))
                                }
                            })
                        })
                    })
                })
            })
        })
        
    }
    getOTP(){
        return new Promise((resolve, reject)=>{
            this.requestLauncher.post({ // get otp
                url: '/launcher/get_otp/',
                headers: makeHeadersLauncher({
                    'X-Requested-With': 'XMLHttpRequest'
                }),
                body: 'source='
            }, (err, res, body)=>{
                if(err) reject(new Error('Failed to get ticket!'));
                resolve({msg: 'Got ticket!', ticket: JSON.parse(body).otp});
            })
        })
        
    }
}
module.exports = webClient;