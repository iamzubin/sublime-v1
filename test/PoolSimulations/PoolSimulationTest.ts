import { poolCollectionStage } from '../../utils/TestTemplate/poolCollectionStage';
import { Contracts } from '../../existingContracts/compound.json';
import { ChainLinkAggregators, WBTCWhale, WhaleAccount, UNIWhale} from '../../utils/constants-Additions';

describe.only('Test case: Pool using Compound strategy with Borrow Token: DAI and Collateral Token: WBTC', async function () {
    await poolCollectionStage(
        WBTCWhale,
        WhaleAccount,
        Contracts.DAI, 
        Contracts.WBTC,
        Contracts.cDAI,
        Contracts.cWBTC2,
        ChainLinkAggregators['DAI/USD'],
        ChainLinkAggregators['BTC/USD'])
});

describe.only('Test case: Pool using Compound strategy with Borrow Token: UNI and Collateral Token: WBTC', async function () {
    await poolCollectionStage(
        WBTCWhale,
        WhaleAccount,
        Contracts.UNI, 
        Contracts.WBTC,
        Contracts.cUNI,
        Contracts.cWBTC2,
        ChainLinkAggregators['UNI/USD'],
        ChainLinkAggregators['BTC/USD'])
});

describe.only('Test case: Pool using Compound strategy with Borrow Token: USDC and Collateral Token: WBTC', async function () {
    await poolCollectionStage(
        WBTCWhale,
        WhaleAccount,
        Contracts.USDC, 
        Contracts.WBTC,
        Contracts.cUSDC,
        Contracts.cWBTC2,
        ChainLinkAggregators['USDC/USD'],
        ChainLinkAggregators['BTC/USD'])
});

describe.only('Test case: Pool using Compound strategy with Borrow Token: USDT and Collateral Token: WBTC', async function () {
    await poolCollectionStage(
        WBTCWhale,
        WhaleAccount,
        Contracts.USDT, 
        Contracts.WBTC,
        Contracts.cUSDT,
        Contracts.cWBTC2,
        ChainLinkAggregators['USDT/USD'],
        ChainLinkAggregators['BTC/USD'])
});

describe('Test case: Pool using Compound strategy with Borrow Token: COMP and Collateral Token: WBTC', async function () {
    await poolCollectionStage(
        WBTCWhale,
        WhaleAccount,
        Contracts.Comp, 
        Contracts.WBTC,
        Contracts.cComp,
        Contracts.cWBTC2,
        ChainLinkAggregators['COMP/USD'],
        ChainLinkAggregators['BTC/USD'])
});

describe('Test case: Pool using Compound strategy with Borrow Token: USDC and Collateral Token: UNI', async function () {
    await poolCollectionStage(
        UNIWhale,
        WhaleAccount,
        Contracts.USDC, 
        Contracts.UNI,
        Contracts.cUSDC,
        Contracts.cUNI,
        ChainLinkAggregators['USDC/USD'],
        ChainLinkAggregators['UNI/USD'])
});