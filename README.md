# Sublime Protocol

[![codecov](https://codecov.io/gh/sublime-finance/sublime-v1/branch/master/graph/badge.svg?token=30JPP4ZVOY)](https://codecov.io/gh/sublime-finance/sublime-v1)

## Overview

Sublime is a decentralized protocol for building and accessing credit. Borrowers can use Sublime to create fully-customizable loan pools or credit lines, allowing them to utilize their social capital to borrow undercollateralized loans from lenders that trust them. The protocol has been developed with the idea of trust minimization - a lender’s capital is only utilized by borrowers they trust. Integration with overcollateralized money markets like Compound enables lenders to generate passive yield on their assets for times when users they trust aren’t actively borrowing. Sublime also features a flexible identity verification module which allows users to link their identities to their wallet addresses to bootstrap their on-chain reputation.

For more information, please refer to the [documentation](https://docs.sublime.finance/).

To learn more, please join the [Discord server](https://discord.com/invite/EjvU2H4H3J).

# Installation and Testing Steps
### Requirements
1. node version >12.x
2. npm version >6.x

### Once the repo is cloned run the command below to install all the dependencies
> npm install --save-dev 

### Create a .env file with contents as mentioned

> touch .env

Atleast 4 private keys must be provided. The keys must be comma seperated as shown below

`privKey1,privKey2,privKey3,privKey4`

It recommended to use new private keys whenever you clone the repo. You generate new private keys using https://vanity-eth.tk/

**Sample .env file:**
```
PRIVATE_KEYS=4fda40eb4eca4113858b440941953bce0ac10a1b7c2b78cef70c53ee334c9a04,933cc22684708d10f6184245c7fab66e80ed3809d96f1f34ebd8b035fa67dd2d,94f96324f8a230558bb1e2cdc00a0cdf4812e3764a3d04414fb9fffe13307676,420cd36f64e399d5a2493ed85c75a1a7fb3f127105fe1a2f7c270887d3177e28

LOGGING=false
SAVE_DEPLOYMENT=false
REPORT_GAS=true
```

### Compile contracts
Compile the contracts using the command below
 > npm run compile

### Test the contracts
The repo comes with existing tests. To run existing tests run 
> npm run test

To add new tests to the repo,

> touch test/newTest.spec.ts
Edit the contents of `test/newTest.spec.ts`
re-run the tests using 
> npm run test
