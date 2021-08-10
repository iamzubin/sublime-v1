import { calculateNewPoolAddress, createEnvironment, createNewPool } from '../../utils/createEnv';
import {
    CompoundPair,
    CreditLineDefaultStrategy,
    CreditLineInitParams,
    Environment,
    ExtensionInitParams,
    PoolCreateParams,
    PoolFactoryInitParams,
    PriceOracleSource,
    RepaymentsInitParams,
    YearnPair,
} from '../../utils/types';
import hre from 'hardhat';
import { Contracts } from '../../existingContracts/compound.json';

import {
    WBTCWhale,
    WhaleAccount,
    Binance7,
    WBTC_Yearn_Protocol_Address,
    HEGIC_Token_Address,
    HEGIC_Yearn_Protocol_Address,
    ChainLinkAggregators,
    extensionParams,
    repaymentParams,
    testPoolFactoryParams,
} from '../../utils/constants-Additions';

import DeployHelper from '../../utils/deploys';
import { ERC20 } from '../../typechain/ERC20';
import { sha256 } from '@ethersproject/sha2';
import { BigNumber } from 'ethers';
import { IYield } from '@typechain/IYield';

describe('Pool using Yearn Strategy with HEGIC (Borrow Token) and WBTC (Collateral Token)', async () => {
    let env: Environment;
    before(async () => {
        env = await createEnvironment(
            hre,
            [WBTCWhale, WhaleAccount, Binance7],
            [] as CompoundPair[],
            [
                { asset: HEGIC_Token_Address, liquidityToken: HEGIC_Yearn_Protocol_Address },
                { asset: Contracts.WBTC, liquidityToken: WBTC_Yearn_Protocol_Address },
            ] as YearnPair[],
            [
                { tokenAddress: HEGIC_Token_Address, feedAggregator: ChainLinkAggregators['HEGIC/USD'] },
                { tokenAddress: Contracts.WBTC, feedAggregator: ChainLinkAggregators['BTC/USD'] },
            ] as PriceOracleSource[],
            {
                votingPassRatio: extensionParams.votingPassRatio,
            } as ExtensionInitParams,
            {
                gracePenalityRate: repaymentParams.gracePenalityRate,
                gracePeriodFraction: repaymentParams.gracePeriodFraction,
            } as RepaymentsInitParams,
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
            } as PoolFactoryInitParams,
            CreditLineDefaultStrategy.Compound,
            { _protocolFeeFraction: testPoolFactoryParams._protocolFeeFraction } as CreditLineInitParams
        );
    });

    it('Sample', async function () {
        let salt = sha256(Buffer.from(`borrower-${new Date().valueOf()}`));
        let { admin, borrower, lender } = env.entities;
        let deployHelper: DeployHelper = new DeployHelper(admin);
        let HEGIC: ERC20 = await deployHelper.mock.getMockERC20(HEGIC_Token_Address);
        let WBTC: ERC20 = await deployHelper.mock.getMockERC20(Contracts.WBTC);
        let iyield: IYield = await deployHelper.mock.getYield(env.yields.yearnYield.address);

        let poolAddress = await calculateNewPoolAddress(env, HEGIC, WBTC, iyield, salt, false, {
            _poolSize: BigNumber.from(100).mul(BigNumber.from(10).pow(18)),
            _minborrowAmount: BigNumber.from(10).mul(BigNumber.from(10).pow(18)),
            _borrowRate: BigNumber.from(1).mul(BigNumber.from(10).pow(28)),
            _collateralAmount: BigNumber.from(1).mul(BigNumber.from(10).pow(8)),
            _collateralRatio: BigNumber.from(250).mul(BigNumber.from(10).pow(28)),
            _collectionPeriod: 10000,
            _matchCollateralRatioInterval: 200,
            _noOfRepaymentIntervals: 100,
            _repaymentInterval: 1000,
        });

        console.log({ calculatedPoolAddress: poolAddress });

        console.log("Borrow Token: ", env.mockTokenContracts[0].name);
        console.log("Collateral Token: ", env.mockTokenContracts[1].name);
        await env.mockTokenContracts[1].contract.connect(env.impersonatedAccounts[0]).transfer(admin.address, '100000000');
        await env.mockTokenContracts[1].contract.connect(admin).transfer(borrower.address, '100000000');
        await env.mockTokenContracts[1].contract.connect(borrower).approve(poolAddress, '100000000');

        let pool = await createNewPool(env, HEGIC, WBTC, iyield, salt, false, {
            _poolSize: BigNumber.from(100).mul(BigNumber.from(10).pow(18)),
            _minborrowAmount: BigNumber.from(10).mul(BigNumber.from(10).pow(18)),
            _borrowRate: BigNumber.from(1).mul(BigNumber.from(10).pow(28)),
            _collateralAmount: BigNumber.from(1).mul(BigNumber.from(10).pow(8)),
            _collateralRatio: BigNumber.from(250).mul(BigNumber.from(10).pow(28)),
            _collectionPeriod: 10000,
            _matchCollateralRatioInterval: 200,
            _noOfRepaymentIntervals: 100,
            _repaymentInterval: 1000,
        });

        console.log({ actualPoolAddress: pool.address });
    });
});
