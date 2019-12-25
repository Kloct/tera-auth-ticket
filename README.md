# tera-auth-ticket

***For the North American (En Masse) and European (Gameforge) TERA regions only.***
> This module is an updated rewrite of [meishuu/tera-auth-ticket](https://github.com/meishuu/tera-auth-ticket) with muti-region support.

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
