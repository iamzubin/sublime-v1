import { poolCreationTest } from '../../utils/templates/test1-pool_creation_template';

import {Contracts} from '../../existingContracts/compound.json'

import {
    USDTWhale,
    USDCWhale,
    DAIWhale,
    LINKWhale,
    ChainLinkAggregators,
    WBTCWhale, 
    WhaleAccount,
    UNIWhale
} from '../../utils/constants-rahul';

const testCases = [
    {   
        Amount: 100,
        Whale1: UNIWhale,
        Whale2: WhaleAccount,
        BorrowTokenParam: Contracts.USDC,
        CollateralTokenParam: Contracts.UNI,
        liquidityBorrowTokenParam: Contracts.cUSDC,
        liquidityCollateralTokenParam: Contracts.cUNI,
        chainlinkBorrowParam: ChainLinkAggregators['USDC/USD'],
        chainlinkCollateralParam: ChainLinkAggregators['UNI/USD']
    },
    {   
        Amount: 1,
        Whale1: WBTCWhale,
        Whale2: WhaleAccount,
        BorrowTokenParam: Contracts.DAI,
        CollateralTokenParam: Contracts.WBTC,
        liquidityBorrowTokenParam: Contracts.cDAI,
        liquidityCollateralTokenParam: Contracts.cWBTC2,
        chainlinkBorrowParam: ChainLinkAggregators['DAI/USD'],
        chainlinkCollateralParam: ChainLinkAggregators['BTC/USD']
    },
    {   
        Amount: 275,
        Whale1: USDCWhale,
        Whale2: DAIWhale,
        BorrowTokenParam: Contracts.USDC,
        CollateralTokenParam: Contracts.DAI,
        liquidityBorrowTokenParam: Contracts.cUSDC,
        liquidityCollateralTokenParam: Contracts.cDAI,
        chainlinkBorrowParam: ChainLinkAggregators['USDC/USD'],
        chainlinkCollateralParam: ChainLinkAggregators['DAI/USD']
    }
];

describe("Testing pool creation", function() {
     testCases.forEach(testCase => {
         poolCreationTest(
            testCase.Amount,
            testCase.Whale1,
            testCase.Whale2,
            testCase.BorrowTokenParam,
            testCase.CollateralTokenParam,
            testCase.liquidityBorrowTokenParam,
            testCase.liquidityCollateralTokenParam,
            testCase.chainlinkBorrowParam,
            testCase.chainlinkCollateralParam
        );
    });
});