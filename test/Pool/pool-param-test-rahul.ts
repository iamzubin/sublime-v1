import { poolCreationTest } from '../../utils/templates/poolGenerationTemplate';
import { poolLendingTest } from '../../utils/templates/poolLendingTemplate';

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
    // await poolCreationTest(
    //     DAIWhale,
    //     LINKWhale,
    //     Contracts.DAI,
    //     Contracts.LINK,
    //     Contracts.cDAI,
    //     "0x95812193E603cA35b55025C242934BAd1a308305",
    //     ChainLinkAggregators['DAI/USD'],
    //     ChainLinkAggregators['LINK/USD']
    // );

    // await poolCreationTest(
    //     USDTWhale,
    //     LINKWhale,
    //     Contracts.USDT,
    //     Contracts.LINK,
    //     Contracts.cUSDT,
    //     "0x95812193E603cA35b55025C242934BAd1a308305",
    //     ChainLinkAggregators["USDT/USD"],
    //     ChainLinkAggregators["LINK/USD"]
    // );

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

