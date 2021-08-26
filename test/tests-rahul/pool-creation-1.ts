import { poolLendingTest } from '../../utils/templates/poolCreationTemplate';

import {Contracts} from '../../existingContracts/compound.json'

import {
    USDTWhale,
    DAIWhale,
    LINKWhale,
    ChainLinkAggregators,
    WBTCWhale, 
    WhaleAccount,
    UNIWhale
} from '../../utils/constants-rahul';

describe("Testing", async () => {
    await poolLendingTest(
        100,
        UNIWhale,
        WhaleAccount,
        Contracts.USDC,
        Contracts.UNI,
        Contracts.cUSDC,
        Contracts.cUNI,
        ChainLinkAggregators['USDC/USD'],
        ChainLinkAggregators['UNI/USD']
    );

    await poolLendingTest(
        1,
        WBTCWhale,
        WhaleAccount,
        Contracts.DAI,
        Contracts.WBTC,
        Contracts.cDAI,
        Contracts.cWBTC2,
        ChainLinkAggregators['DAI/USD'],
        ChainLinkAggregators['BTC/USD'],
    );  
});

