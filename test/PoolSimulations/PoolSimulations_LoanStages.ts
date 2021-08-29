import { compoundPoolCollectionStage } from '../../utils/TestTemplate/Compound_poolLoanStages';
import { yearnPoolCollectionStage } from '../../utils/TestTemplate/Yearn_poolLoanStages'
import { Contracts } from '../../existingContracts/compound.json';
import { 
    ChainLinkAggregators, 
    WBTCWhale, 
    WhaleAccount, 
    UNIWhale,
    INCHWhale,
    DAI_Yearn_Protocol_Address,
    USDC_Yearn_Protocol_Address,
    USDT_Yearn_Protocol_Address,
    INCH_Yearn_Protocol_Address,
    HEGIC_Yearn_Protocol_Address,
    YFI_Yearn_Protocol_Address,
    WBTC_Yearn_Protocol_Address,
    INCH_Token_Address,
    HEGIC_Token_Address,
    YFI_Token_Address,
    zeroAddress
} from '../../utils/constants-Additions';

describe('Test case: Pool using Compound strategy with Borrow Token: DAI and Collateral Token: WBTC', async function () {
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

describe('Test case: Pool using Compound strategy with Borrow Token: UNI and Collateral Token: WBTC', async function () {
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

describe('Test case: Pool using Compound strategy with Borrow Token: USDC and Collateral Token: WBTC', async function () {
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

describe('Test case: Pool using Compound strategy with Borrow Token: USDT and Collateral Token: WBTC', async function () {
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

describe('Test case: Pool using Compound strategy with Borrow Token: COMP and Collateral Token: WBTC', async function () {
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

describe('Test case: Pool using Compound strategy with Borrow Token: USDC and Collateral Token: UNI', async function () {
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

describe('Test case: Pool using Compound strategy with Borrow Token: USDT and Collateral Token: UNI', async function () {
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

// Special case
describe('Test case: Pool using Compound strategy with Borrow Token: DAI and Collateral Token: UNI', async function () {
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

describe('Test case: Pool using Compound strategy with Borrow Token: DAI and Collateral Token: COMP', async function () {
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

describe('Test case: Pool using Compound strategy with Borrow Token: USDC and Collateral Token: COMP', async function () {
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

describe('Test case: Pool using Compound strategy with Borrow Token: USDT and Collateral Token: COMP', async function () {
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

describe('Test case: Pool using Compound strategy with Borrow Token: UNI and Collateral Token: COMP', async function () {
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

// YEARN STRATEGY: Fix issues with IyVault

describe('Test case: Pool using Yearn strategy with Borrow Token: DAI and Collateral Token: WBTC', async function () {
    await yearnPoolCollectionStage(
        1,
        WBTCWhale,
        WhaleAccount,
        Contracts.DAI, 
        Contracts.WBTC,
        DAI_Yearn_Protocol_Address,
        WBTC_Yearn_Protocol_Address,
        ChainLinkAggregators['DAI/USD'],
        ChainLinkAggregators['BTC/USD'])
});

describe('Test case: Pool using Yearn strategy with Borrow Token: USDC and Collateral Token: WBTC', async function () {
    await yearnPoolCollectionStage(
        1,
        WBTCWhale,
        WhaleAccount,
        Contracts.USDC, 
        Contracts.WBTC,
        USDC_Yearn_Protocol_Address,
        WBTC_Yearn_Protocol_Address,
        ChainLinkAggregators['USDC/USD'],
        ChainLinkAggregators['BTC/USD'])
});

describe('Test case: Pool using Yearn strategy with Borrow Token: USDT and Collateral Token: WBTC', async function () {
    await yearnPoolCollectionStage(
        1,
        WBTCWhale,
        WhaleAccount,
        Contracts.USDT, 
        Contracts.WBTC,
        USDT_Yearn_Protocol_Address,
        WBTC_Yearn_Protocol_Address,
        ChainLinkAggregators['USDT/USD'],
        ChainLinkAggregators['BTC/USD'])
});

describe('Test case: Pool using Yearn strategy with Borrow Token: INCH and Collateral Token: WBTC', async function () {
    await yearnPoolCollectionStage(
        1,
        WBTCWhale,
        INCHWhale,
        INCH_Token_Address,
        Contracts.WBTC,
        INCH_Yearn_Protocol_Address,
        WBTC_Yearn_Protocol_Address,
        ChainLinkAggregators['INCH/USD'],
        ChainLinkAggregators['BTC/USD'])
});

// Have to find a holder for HEGIC
// YFI fails on deploy: Check the issue
describe('Test case: Pool using Yearn strategy with Borrow Token: HEGIC and Collateral Token: WBTC', async function () {
    await yearnPoolCollectionStage(
        10,
        WBTCWhale,
        WhaleAccount,
        HEGIC_Token_Address,
        Contracts.WBTC,
        HEGIC_Yearn_Protocol_Address,
        WBTC_Yearn_Protocol_Address,
        ChainLinkAggregators['HEGIC/USD'],
        ChainLinkAggregators['BTC/USD'])
});

describe('Test case: Pool using Yearn strategy with Borrow Token: YFI and Collateral Token: WBTC', async function () {
    await yearnPoolCollectionStage(
        1000,
        WBTCWhale,
        INCHWhale,
        YFI_Token_Address, 
        Contracts.WBTC,
        YFI_Yearn_Protocol_Address,
        WBTC_Yearn_Protocol_Address,
        ChainLinkAggregators['YFI/USD'],
        ChainLinkAggregators['BTC/USD'])
});