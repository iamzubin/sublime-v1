import { calculateNewPoolAddress, createEnvironment, createNewPool } from '../createEnv';
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
} from '../types';
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
} from '../constants-Additions';

import DeployHelper from '../deploys';
import { ERC20 } from '../../typechain/ERC20';
import { sha256 } from '@ethersproject/sha2';
import { BigNumber } from 'ethers';
import { IYield } from '@typechain/IYield';
import { Context } from 'mocha';
import { Address } from 'hardhat-deploy/dist/types';
import { Pool } from '@typechain/Pool';

export async function TestCase(
    BorrowToken: Address, 
    CollateralToken: Address,
    liquidityBorrowToken: Address,
    liquidityCollateralToken: Address,
    chainlinkBorrow: Address,
    ChainlinkCollateral: Address
): Promise<any> {
    describe('Pool using Compound Strategy', async () => {
    let env: Environment;
    let pool: Pool;
    let poolAddress: Address;

    let deployHelper: DeployHelper;
    let BorrowAsset: ERC20;
    let CollateralAsset: ERC20;
    let iyield: IYield;

    before(async () => {
        env = await createEnvironment(
            hre,
            [WBTCWhale, WhaleAccount, Binance7],
            [
                { asset: BorrowToken, liquidityToken: liquidityBorrowToken},
                { asset: CollateralToken, liquidityToken: liquidityCollateralToken },
            ] as CompoundPair[],
            [] as YearnPair[],
            [
                { tokenAddress: BorrowToken, feedAggregator: chainlinkBorrow },
                { tokenAddress: CollateralToken, feedAggregator: ChainlinkCollateral },
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

        let salt = sha256(Buffer.from(`borrower-${new Date().valueOf()}`));
        let { admin, borrower, lender } = env.entities;
        deployHelper = new DeployHelper(admin);
        BorrowAsset = await deployHelper.mock.getMockERC20(env.mockTokenContracts[0].contract.address);
        CollateralAsset = await deployHelper.mock.getMockERC20(env.mockTokenContracts[1].contract.address);
        iyield = await deployHelper.mock.getYield(env.yields.compoundYield.address);

        poolAddress = await calculateNewPoolAddress(env, BorrowAsset, CollateralAsset, iyield, salt, false, {
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

        pool = await createNewPool(env, BorrowAsset, CollateralAsset, iyield, salt, false, {
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

    it('Borrower should be able to deposit Collateral to the pool', async function () {
        let { admin, borrower, lender } = env.entities;
        // Transfering again as the initial amount was used for initial deposit
        await env.mockTokenContracts[1].contract.connect(env.impersonatedAccounts[0]).transfer(admin.address, '100000000');
        await env.mockTokenContracts[1].contract.connect(admin).transfer(borrower.address, '100000000');
        await env.mockTokenContracts[1].contract.connect(borrower).approve(poolAddress, '100000000');
        await pool.connect(borrower).depositCollateral(BigNumber.from('100000000'),false);
        console.log("Collateral Added directly!");
    });

    it('Lender should be able to lend the borrow tokens to the pool', async function () {
        let { admin, borrower, lender } = env.entities;
        //Lenders can lend borrow Tokens into the pool
        await env.mockTokenContracts[0].contract.connect(env.impersonatedAccounts[1]).transfer(admin.address, '10000000000000000000');
        await env.mockTokenContracts[0].contract.connect(admin).transfer(lender.address, '10000000000000000000');
        await env.mockTokenContracts[0].contract.connect(lender).approve(poolAddress, '10000000000000000000');
        await pool.connect(lender).lend(lender.address, BigNumber.from('10000000000000000000'), false);
        console.log("1 Lender lent the entire amount!");
    });
});
}