import { poolCollectionStage } from '../../utils/TestTemplate/poolCollectionStage';
import { Contracts } from '../../existingContracts/compound.json';
import { ChainLinkAggregators } from '../../utils/constants-Additions';

describe.only('Test case: Pool using Compound strategy with Borrow Token: DAI and Collateral Token: WBTC', async function () {
    await poolCollectionStage(
        Contracts.DAI, 
        Contracts.WBTC,
        Contracts.cDAI,
        Contracts.cWBTC2,
        ChainLinkAggregators['DAI/USD'],
        ChainLinkAggregators['BTC/USD'])
});