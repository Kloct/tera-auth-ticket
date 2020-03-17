const axios = require('axios').default;
const log = require('log');
const logThis = log('tera-auth-ticket');
const querystring = require('querystring');
const axiosCookieJarSupport = require('axios-cookiejar-support').default;
const tough = require('tough-cookie');
const fs = require('fs');
const readline = require('readline')

const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
function question(q) { return new Promise(resolve => { rl.question(q, resolve) }) }

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

class webClient {
    constructor(email, password) {
        this.email = email
        this.password = password
        this.axiosDestiny = axios.create({
            baseURL: 'https://id.ddestiny.ru',
            headers: makeHeadersDestiny(),
            withCredentials: true,
            validateStatus: status=>status < 400
        })
        axiosCookieJarSupport(this.axiosDestiny);
        this.axiosDestiny.defaults.jar = new tough.CookieJar();
        this.axiosLauncher = axios.create({
            baseURL: 'http://launcher.tera-online.ru',
            headers: makeHeadersLauncher(),
            withCredentials: true,
            validateStatus: status=>status < 400
        })
        axiosCookieJarSupport(this.axiosLauncher);
        this.axiosLauncher.defaults.jar = new tough.CookieJar();
    }

    async getLogin(){
        // Session Id
        await this.axiosDestiny.get('/bar', { params: {project: 'tera'} })
        // csrf
        let popup = await this.axiosDestiny.get('/bar/popup/login/')
        let creds = {
            csrfmiddlewaretoken: popup.config.jar.toJSON().cookies.filter((cookie)=>cookie.key==='destinyid_csrftoken')[0].value,
            username: this.email,
            password: this.password
        }
        // captcha detection
        if (popup.data.match(/\/captcha\/image\/.{41}/)) {
            creds.captcha_0 = popup.data.match(/\/captcha\/image\/.{41}/)[0].match(/\w{40,40}/)
            this.axiosDestiny.get(popup.data.match(/\/captcha\/image\/.{41}/)[0], { responseType: 'stream' })
                .then(res=> {
                    res.data.pipe(fs.createWriteStream('captcha.jpg'))
                })
            logThis.log('Captcha Detected!, Dowloaded to "node_modules/tera-auth-ticket/captcha.jpg".')
            let captcha = await question('Enter the captcha solution: ')
            creds.captcha_1 = captcha
            fs.unlink('captcha.jpg', err=>{ if (err) throw err })
        }
        // login
        let login = await this.axiosDestiny({
            method: 'post',
            url: 'https://id.ddestiny.ru/bar/popup/login/', // need to specify full url for cookie to work
            maxRedirects: 0,
            headers: makeHeadersDestiny({
                'Content-Type': 'application/x-www-form-urlencoded',
                'Referer': 'https://id.ddestiny.ru/bar/popup/login/'
            }),
            data: querystring.stringify(creds)
        })
        if (login.headers.location === '/bar/popup/login/twofactor/?') {
            let twoFactorRes = await this.axiosDestiny.get('https://id.ddestiny.ru/bar/popup/login/twofactor/?', {
                headers: makeHeadersDestiny({
                    'Referer': 'https://id.ddestiny.ru/bar/popup/login/'
                })
            })
            logThis.log(`2FA Required to continue! An email with a One Time Password has been sent to ${this.email}`)
            let code = await question('Enter OTP: ')
            // Check Captcha in OTP Form
            let twoFactorCaptcha = {}
            if (twoFactorRes.data.match(/\/captcha\/image\/.{41}/)) {
                twoFactorCaptcha.captcha_0 = twoFactorRes.data.match(/\/captcha\/image\/.{41}/)[0].match(/\w{40,40}/)
                this.axiosDestiny.get(twoFactorRes.data.match(/\/captcha\/image\/.{41}/)[0], { responseType: 'stream' })
                    .then(res=> {
                        res.data.pipe(fs.createWriteStream('captcha.jpg'))
                    })
                logThis.log('Captcha Detected in OTP!, Dowloaded to "node_modules/tera-auth-ticket/captcha.jpg".')
                let captcha = await question('Enter the captcha solution: ')
                twoFactorCaptcha.captcha_1 = captcha
                fs.unlink('captcha.jpg', err=>{ if (err) throw err })
            }
            // Post OTP Form
            await this.axiosDestiny({
                method: 'post',
                url: 'https://id.ddestiny.ru/bar/popup/login/twofactor/?',
                maxRedirects: 0,
                headers: makeHeadersDestiny({
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Referer': 'https://id.ddestiny.ru/bar/popup/login/twofactor/?'
                }),
                data: querystring.stringify(
                    Object.assign({
                        'otp_challenge': '',
                        'csrfmiddlewaretoken': creds.csrfmiddlewaretoken,
                        'otp_token': code
                    }, twoFactorCaptcha)
                )
            })
                .then(res=>{
                    if (res.status!=302) {
                        rl.close()
                        throw `Incorrect OTP${twoFactorCaptcha.captcha_1?' or Captcha':''}!`
                    }
                })
        }
        if (login.status!==302){
            rl.close()
            throw `Failed to login! Incorrect username/password${creds.captcha_0?'/captcha':''}`
        }
        rl.close()

        logThis.log('Login Successful');
        // Launcher OAuth
        let oAuthStart = await this.axiosLauncher.get('/login/destinyid/?next=http%3A%2F%2Flauncher.tera-online.ru%2Flauncher%2F%3Fosid%3D4105790410', {maxRedirects: 0})
        await this.axiosDestiny.get(oAuthStart.headers.location, {maxRedirects: 0})
        await this.axiosDestiny.get('/oauth2/authorize/confirm', {maxRedirects: 0})
        let oAuthRedirect = await this.axiosDestiny.get('/oauth2/redirect', {maxRedirects: 0})
        let oAuthComplete = await this.axiosLauncher.get(oAuthRedirect.headers.location, {maxRedirects: 0})
        logThis.log(`OAuth complete (Account: #${oAuthComplete.headers['x-accel-userid']})`)
        // Auth ticket
        let { data: authTicket } = await this.axiosLauncher.post('/launcher/get_otp/', {
            headers: makeHeadersLauncher({
                'X-Requested-With': 'XMLHttpRequest'
            }),
            data: 'source='
        })
        return {name: oAuthComplete.headers['x-accel-userid'], ticket: authTicket.otp}
    }
}
module.exports = webClient;