const webNA = require('./regions/na');
const webEU = require('./regions/eu');
const webRU = require('./regions/ru');

class webClient {
    constructor(region, email, password, account) {
        this.region = region;
        this.email = email;
        this.password = password;
        this.account = account;
        this.web;
    }
    async getLogin(callback){
        try {
            switch (this.region){
                case 'na': 
                    this.web = new webNA(this.email, this.password);
                    break;
                case 'eu': 
                    this.web = new webEU(this.email, this.password, this.account);
                    break;
                case 'ru':
                    this.web = new webRU(this.email, this.password);
                    break;
                default:
                    throw `Unsupported Region: "${this.region}"!`
            }
            callback(null, await this.web.getLogin())
        } catch(err){
            callback(err)
        }
    }
}

module.exports = webClient;