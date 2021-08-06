import { createEnvironment } from '../../utils/createEnv';
import { CompoundPair, CreditLineDefaultStrategy, Environment, PriceOracleSource, YearnPair } from '../../utils/types';
import hre from 'hardhat';
import { Contracts } from '../../existingContracts/compound.json';

import {
    WBTCWhale,
    WhaleAccount,
    Binance7,
    ChainLinkAggregators,
    extensionParams,
    repaymentParams,
    testPoolFactoryParams,
} from '../../utils/constants';

describe.only('Pool With Compound Strategy 2', async () => {
    let env: Environment;
    before(async () => {
        env = await createEnvironment(
            hre,
            [WBTCWhale, WhaleAccount, Binance7],
            [
                { asset: Contracts.DAI, liquidityToken: Contracts.cDAI },
                { asset: Contracts.WBTC, liquidityToken: Contracts.cWBTC2 },
            ] as CompoundPair[],
            [] as YearnPair[],
            [
                { tokenAddress: Contracts.DAI, feedAggregator: ChainLinkAggregators['DAI/USD'] },
                { tokenAddress: Contracts.WBTC, feedAggregator: ChainLinkAggregators['BTC/USD'] },
            ] as PriceOracleSource[],
            {
                votingPassRatio: extensionParams.votingPassRatio,
            },
            { gracePenalityRate: repaymentParams.gracePenalityRate, gracePeriodFraction: repaymentParams.gracePeriodFraction },
            {
                admin: '',
                _collectionPeriod: testPoolFactoryParams._collectionPeriod,
                _matchCollateralRatioInterval: testPoolFactoryParams._matchCollateralRatioInterval,
                _marginCallDuration: testPoolFactoryParams._marginCallDuration,
                _gracePeriodPenaltyFraction: testPoolFactoryParams._gracePeriodPenaltyFraction,
                _poolInitFuncSelector: testPoolFactoryParams._poolInitFuncSelector,
                _poolTokenInitFuncSelector: testPoolFactoryParams._poolTokenInitFuncSelector,
                _liquidatorRewardFraction: testPoolFactoryParams._liquidatorRewardFraction,
                _poolCancelPenalityFraction: testPoolFactoryParams._poolCancelPenalityFraction,
                _protocolFeeFraction: testPoolFactoryParams._protocolFeeFraction,
                protocolFeeCollector: '',
            },
            CreditLineDefaultStrategy.Compound,
            { _protocolFeeFraction: testPoolFactoryParams._protocolFeeFraction }
        );
    });

    it('Sample', async function () {
        console.log(env);
    });
});
