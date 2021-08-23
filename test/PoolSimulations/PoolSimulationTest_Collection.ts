import { compoundPoolCollectionStage } from '../../utils/TestTemplate/Compound_poolCollectionStage';
import { yearnPoolCollectionStage } from '../../utils/TestTemplate/Yearn_poolCollectionStage'
import { Contracts } from '../../existingContracts/compound.json';
import { 
    ChainLinkAggregators, 
    WBTCWhale, 
    WhaleAccount, 
    UNIWhale,
    DAI_Yearn_Protocol_Address,
    WBTC_Yearn_Protocol_Address,
    zeroAddress
} from '../../utils/constants-Additions';

describe.only('Test case: Pool using Compound strategy with Borrow Token: DAI and Collateral Token: WBTC', async function () {
    await compoundPoolCollectionStage(
        1,
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
    await compoundPoolCollectionStage(
        1,
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
    await compoundPoolCollectionStage(
        1,
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
    await compoundPoolCollectionStage(
        1,
        WBTCWhale,
        WhaleAccount,
        Contracts.USDT, 
        Contracts.WBTC,
        Contracts.cUSDT,
        Contracts.cWBTC2,
        ChainLinkAggregators['USDT/USD'],
        ChainLinkAggregators['BTC/USD'])
});

describe.only('Test case: Pool using Compound strategy with Borrow Token: COMP and Collateral Token: WBTC', async function () {
    await compoundPoolCollectionStage(
        10,
        WBTCWhale,
        WhaleAccount,
        Contracts.Comp, 
        Contracts.WBTC,
        Contracts.cComp,
        Contracts.cWBTC2,
        ChainLinkAggregators['COMP/USD'],
        ChainLinkAggregators['BTC/USD'])
});

describe.only('Test case: Pool using Compound strategy with Borrow Token: USDC and Collateral Token: UNI', async function () {
    await compoundPoolCollectionStage(
        100,
        UNIWhale,
        WhaleAccount,
        Contracts.USDC, 
        Contracts.UNI,
        Contracts.cUSDC,
        Contracts.cUNI,
        ChainLinkAggregators['USDC/USD'],
        ChainLinkAggregators['UNI/USD'])
});

describe.only('Test case: Pool using Compound strategy with Borrow Token: USDT and Collateral Token: UNI', async function () {
    await compoundPoolCollectionStage(
        100,
        UNIWhale,
        WhaleAccount,
        Contracts.USDT, 
        Contracts.UNI,
        Contracts.cUSDT,
        Contracts.cUNI,
        ChainLinkAggregators['USDT/USD'],
        ChainLinkAggregators['UNI/USD'])
});

describe.only('Test case: Pool using Compound strategy with Borrow Token: DAI and Collateral Token: UNI', async function () {
    await compoundPoolCollectionStage(
        100,
        UNIWhale,
        WhaleAccount,
        Contracts.DAI, 
        Contracts.UNI,
        Contracts.cDAI,
        Contracts.cUNI,
        ChainLinkAggregators['DAI/USD'],
        ChainLinkAggregators['UNI/USD'])
});

describe.only('Test case: Pool using Compound strategy with Borrow Token: DAI and Collateral Token: COMP', async function () {
    await compoundPoolCollectionStage(
        100,
        UNIWhale,
        WhaleAccount,
        Contracts.DAI, 
        Contracts.Comp,
        Contracts.cDAI,
        Contracts.cComp,
        ChainLinkAggregators['DAI/USD'],
        ChainLinkAggregators['COMP/USD'])
});

describe.only('Test case: Pool using Compound strategy with Borrow Token: USDC and Collateral Token: COMP', async function () {
    await compoundPoolCollectionStage(
        100,
        UNIWhale,
        WhaleAccount,
        Contracts.USDC, 
        Contracts.Comp,
        Contracts.cUSDC,
        Contracts.cComp,
        ChainLinkAggregators['USDC/USD'],
        ChainLinkAggregators['COMP/USD'])
});

describe.only('Test case: Pool using Compound strategy with Borrow Token: USDT and Collateral Token: COMP', async function () {
    await compoundPoolCollectionStage(
        100,
        UNIWhale,
        WhaleAccount,
        Contracts.USDT, 
        Contracts.Comp,
        Contracts.cUSDT,
        Contracts.cComp,
        ChainLinkAggregators['USDT/USD'],
        ChainLinkAggregators['COMP/USD'])
});

describe.only('Test case: Pool using Compound strategy with Borrow Token: UNI and Collateral Token: COMP', async function () {
    await compoundPoolCollectionStage(
        100,
        UNIWhale,
        WhaleAccount,
        Contracts.UNI, 
        Contracts.Comp,
        Contracts.cUNI,
        Contracts.cComp,
        ChainLinkAggregators['UNI/USD'],
        ChainLinkAggregators['COMP/USD'])
});
// yearn Strategy: Fix issues with IyVault
describe('Test case: Pool using Yearn strategy with Borrow Token: DAI and Collateral Token: WBTC', async function () {
    await yearnPoolCollectionStage(
        10,
        WBTCWhale,
        WhaleAccount,
        Contracts.DAI, 
        Contracts.WBTC,
        DAI_Yearn_Protocol_Address,
        WBTC_Yearn_Protocol_Address,
        ChainLinkAggregators['DAI/USD'],
        ChainLinkAggregators['BTC/USD'])
});