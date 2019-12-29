const webNA = require('./regions/na');
const webEU = require('./regions/eu');
const webRU = require('./regions/ru');

class webClient {
    constructor(region, email, password) {
        this.region = region
        this.email = email;
        this.password = password;
    }
    getLogin(callback){
        let web
        switch (this.region){
            case 'na': 
                web = new webNA(this.email, this.password);
                break;
            case 'eu': 
                web = new webEU(this.email, this.password);
                break;
            case 'ru':
                web = new webRU(this.email, this.password);
                break;
            default:
                callback(new Error(`Unsupported Region ${this.region}`))
        }
        web.getLogin((err, data) => {
            if (err) callback(err)
            else callback(null, data)
        })
    }
}

module.exports = webClient;