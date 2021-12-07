# Sublime Protocol

[![codecov](https://codecov.io/gh/sublime-finance/sublime-v1/branch/master/graph/badge.svg?token=30JPP4ZVOY)](https://codecov.io/gh/sublime-finance/sublime-v1)

## Overview

Sublime is a decentralized protocol for building and accessing credit. Borrowers can use Sublime to create fully-customizable loan pools or credit lines, allowing them to utilize their social capital to borrow undercollateralized loans from lenders that trust them. The protocol has been developed with the idea of trust minimization - a lender’s capital is only utilized by borrowers they trust. Integration with overcollateralized money markets like Compound enables lenders to generate passive yield on their assets for times when users they trust aren’t actively borrowing. Sublime also features a flexible identity verification module which allows users to link their identities to their wallet addresses to bootstrap their on-chain reputation.

For more information, please refer to the [documentation](https://docs.sublime.finance/).

To learn more, please join the [Discord server](https://discord.com/invite/EjvU2H4H3J).

## Installation

Use `node 12.14.1` or greater
1. Install the required node modules
    `npm install --dev`
2. Generated the required artifacts `npm run build`
3. Test the contract. (by default mainnet fork is used) `npm run test`
