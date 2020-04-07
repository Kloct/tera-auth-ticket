# tera-auth-ticket

***For the North American (En Masse), European (Gameforge), and Russian (Destiny) TERA regions only.***
> This module is an updated alternative to [meishuu/tera-auth-ticket](https://github.com/meishuu/tera-auth-ticket) with muti-region support.

## Usage

```JavaScript
const webClient = require('tera-auth-ticket');
const web = new webClient('(na, eu, ru)', 'email', 'password', 'EUAccountName(optional)');

web.getLogin((err, data) => {
    if (err) console.error(err)
    else console.log(data) // {name: accountName, ticket: ticket}
})
```

Data can be used in `C_LOGIN_ARBITER` to login to the game servers.

## Important Notes

* No regions support IEsnare login currently
* Other regions are planned to be added in the future
* `EUAccountName` is an optional parameter for Gameforge accounts with more than one tera account. You can specify which account you would like to use by setting this to the account's display name.

## Known Issues

### EU

* If logging into multiple accounts, you can only login to up to 4 accounts ever 5 minutes or the account will be blocked.
