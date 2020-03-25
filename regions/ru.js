const axios = require('axios').default,
    log = require('log'),
    logThis = log('tera-auth-ticket'),
    querystring = require('querystring'),
    axiosCookieJarSupport = require('axios-cookiejar-support').default,
    tough = require('tough-cookie'),
    fs = require('fs'),
    readline = require('readline');

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
            'Host': 'www.tera-online.ru',
            'Connection': 'keep-alive',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'User-Agent': 'Mozilla/5.0 (Windows NT 6.2; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/33.0.1750.170 Safari/537.36',
            'Referer': 'https://www.tera-online.ru/launcher/',
            'Accept-Encoding': 'gzip,deflate',
            'Accept-Language': 'en-us,en;q=0.8'
        },
        o
    );
}

class webClient {
    constructor(email, password) {
        this.creds = {
            username: email,
            password: password
        }
        this.axiosDestiny = axios.create({
            baseURL: 'https://id.ddestiny.ru',
            headers: makeHeadersDestiny(),
            withCredentials: true,
            validateStatus: status=>status < 400
        });
        axiosCookieJarSupport(this.axiosDestiny);
        this.axiosDestiny.defaults.jar = new tough.CookieJar();
        this.axiosLauncher = axios.create({
            baseURL: 'https://www.tera-online.ru',
            headers: makeHeadersLauncher(),
            withCredentials: true,
            validateStatus: status=>status < 400
        });
        axiosCookieJarSupport(this.axiosLauncher);
        this.axiosLauncher.defaults.jar = new tough.CookieJar();
    }

    async getLogin(){
        // Session Id
        await this.axiosDestiny.get('/bar', { params: {project: 'tera'} });
        // csrf
        let popup = await this.axiosDestiny.get('/bar/popup/login/');
        this.creds.csrfmiddlewaretoken = popup.config.jar.toJSON().cookies.filter((cookie)=>cookie.key==='destinyid_csrftoken')[0].value
        // login captcha detection
        let captcha = await this.captchaCheck(popup)
        if (captcha) Object.assign(this.creds, captcha)
        // login
        let login = await this.axiosDestiny({
            method: 'post',
            url: 'https://id.ddestiny.ru/bar/popup/login/', // need to specify full url for cookie to work
            maxRedirects: 0,
            headers: makeHeadersDestiny({
                'Content-Type': 'application/x-www-form-urlencoded',
                'Referer': 'https://id.ddestiny.ru/bar/popup/login/'
            }),
            data: querystring.stringify(this.creds)
        });
        // login OTP Check
        await this.OTPCheck(login)
        if (login.status!==302) throw `Failed to login! Incorrect username/password${this.creds.captcha_0?'/captcha':''}`;
        logThis.log('Login Successful');
        // Launcher OAuth
        let oAuthStart = await this.axiosLauncher.get('/login/destinyid/?next=http%3A%2F%2Flauncher.tera-online.ru%2Flauncher%2F%3Fosid%3D4105790410', {maxRedirects: 0});
        await this.axiosDestiny.get(oAuthStart.headers.location, {maxRedirects: 0});
        await this.axiosDestiny.get('/oauth2/authorize/confirm', {maxRedirects: 0});
        let oAuthRedirect = await this.axiosDestiny.get('/oauth2/redirect', {maxRedirects: 0});
        let oAuthComplete = await this.axiosLauncher.get(oAuthRedirect.headers.location, {maxRedirects: 0});
        logThis.log(`OAuth complete (Account: #${oAuthComplete.headers['x-accel-userid']})`);
        // Auth ticket
        let { data: authTicket } = await this.axiosLauncher.post('/launcher/get_otp/', {
            headers: makeHeadersLauncher({
                'X-Requested-With': 'XMLHttpRequest'
            }),
            data: 'source='
        });
        return {name: oAuthComplete.headers['x-accel-userid'], ticket: authTicket.otp};
    };
    async captchaCheck(response) {
        if (response.data.match(/\/captcha\/image\/.{41}/)) {
            const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
            function question(q) { return new Promise(resolve => { rl.question(q, resolve) }) };
            this.axiosDestiny.get(response.data.match(/\/captcha\/image\/.{41}/)[0], { responseType: 'stream' })
                .then(res=> {
                    res.data.pipe(fs.createWriteStream('captcha.jpg')); // download captcha
                });
            logThis.log('Captcha Detected!, Dowloaded as "captcha.jpg".');
            let captcha_1 = await question('Enter the captcha solution: ');
            fs.unlink('captcha.jpg', err=>{ if (err) throw err });
            rl.close()
            return {captcha_0: response.data.match(/\/captcha\/image\/.{41}/)[0].match(/\w{40,40}/), captcha_1}
        } else {
            return false
        }
    }
    async OTPCheck(response) {
        if (response.headers.location === '/bar/popup/login/twofactor/?') {
            const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
            function question(q) { return new Promise(resolve => { rl.question(q, resolve) }) };
            let twoFactorRes = await this.axiosDestiny.get('https://id.ddestiny.ru/bar/popup/login/twofactor/?', {
                headers: makeHeadersDestiny({
                    'Referer': 'https://id.ddestiny.ru/bar/popup/login/'
                })
            });
            logThis.log(`2FA Required to continue! An email with a One Time Password has been sent to ${this.email}`);
            let code = await question('Enter OTP: ');
            rl.close()
            // Check Captcha in OTP Form
            let twoFactorCaptcha = await this.captchaCheck(twoFactorRes)
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
                        'csrfmiddlewaretoken': this.creds.csrfmiddlewaretoken,
                        'otp_token': code
                    }, twoFactorCaptcha)
                )
            })
                .then(res=>{
                    if (res.status!=302) throw `Incorrect OTP${twoFactorCaptcha.captcha_1?' or Captcha':''}!`;
                });
            return
        } else {
            return false
        }
    }
};
module.exports = webClient;