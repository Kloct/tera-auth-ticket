const webNA = require('./regions/na');
const webEU = require('./regions/eu');

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
        }
        web.getLogin((err, data) => {
            if (err) callback(err)
            else callback(null, data)
        })
    }
}

module.exports = webClient;