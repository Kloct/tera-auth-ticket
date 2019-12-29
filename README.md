# tera-auth-ticket

***For the North American (En Masse), European (Gameforge), and Russian (Destiny) TERA regions only.***
> This module is an updated alternative to [meishuu/tera-auth-ticket](https://github.com/meishuu/tera-auth-ticket) with muti-region support.

## Usage

```Javascript
const webClient = require('tera-auth-ticket');
const web = new webClient('(na, eu)', 'email', 'password');

web.getLogin((err, data) => {
    if (err) console.log(err)
    else console.log(data) // {name: accountName, ticket: ticket}
})
```

Data can be used in `C_LOGIN_ARBITER` to login to the game servers.

## Important Notes

* No regions support IEsnare login currently
* Other regions are planned to be added in the future
* Support for Destiny logins is still in early stages and the official launcher will be required to complete any captchas or 2FA requests

## Known Issues

### RU

* Logging in too many times from the same ip too quickly will add a captcha to the login process. As a temporary fix you need to fill out the captcha using the official launcher once and wait 10 minutes for it to dissapear.
* Logging in from a new location for the first time will prompt you for 2FA. You will need to complete 2FA once on the official launcher to authorize your ip.

### EU

* If you have multiple game accounts assiciated with a single Gameforge account you will only be able to access one of them.
