import { poolCreationTest } from '../../utils/templates/poolGenerationTemplate';
import { poolLendingTest } from '../../utils/templates/poolLendingTemplate';

import {Contracts} from '../../existingContracts/compound.json'

import {
    USDTWhale,
    DAIWhale,
    LINKWhale,
    ChainLinkAggregators,
    WBTCWhale, 
    WhaleAccount
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
        DAIWhale,
        LINKWhale,
        Contracts.DAI,
        Contracts.LINK,
        Contracts.cDAI,
        "0x95812193E603cA35b55025C242934BAd1a308305",
        ChainLinkAggregators['DAI/USD'],
        ChainLinkAggregators['LINK/USD']
    );

    await poolLendingTest(
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

