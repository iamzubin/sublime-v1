import { calculateNewPoolAddress, createEnvironment, createNewPool } from '../../../utils/createEnv';
import {
    CompoundPair,
    CreditLineDefaultStrategy,
    CreditLineInitParams,
    Environment,
    ExtensionInitParams,
    PoolFactoryInitParams,
    PriceOracleSource,
    RepaymentsInitParams,
    YearnPair,
} from '../../../utils/types';
import hre from 'hardhat';
const { ethers, network } = hre;
import { expect, assert } from 'chai';

import {
    extensionParams,
    repaymentParams,
    testPoolFactoryParams,
    creditLineFactoryParams,
    createPoolParams,
    zeroAddress,
    ChainLinkAggregators,
} from '../../../utils/constants';
import { testVars as testCases } from "./Pool_marginCall_testEnv";

import DeployHelper from '../../../utils/deploys';
import { ERC20 } from '../../../typechain/ERC20';
import { sha256 } from '@ethersproject/sha2';
import { BigNumber } from 'ethers';
import { IYield } from '@typechain/IYield';
import { Address } from 'hardhat-deploy/dist/types';
import { Pool } from '@typechain/Pool';
import { CompoundYield } from '@typechain/CompoundYield';
import { expectApproxEqual } from '../../../utils/helpers';
import { blockTravel } from '../../../utils/time';
import { getPoolInitSigHash } from '../../../utils/createEnv/poolLogic';

describe.skip('Pool Margin calls cases', function () {
    testCases.forEach((testCase) => {
        marginCallTests(
            testCase.Amount,
            testCase.Whale1,
            testCase.Whale2,
            testCase.BorrowToken,
            testCase.CollateralToken,
            testCase.liquidityBorrowToken,
            testCase.liquidityCollateralToken,
            testCase.chainlinkBorrow,
            testCase.chainlinkCollateral
        );
    });
});

export async function marginCallTests(
    amount: Number,
    whaleAccount1: Address,
    whaleAccount2: Address,
    borrowToken: Address,
    collateralToken: Address,
    liquidityBorrowToken: Address,
    liquidityCollateralToken: Address,
    chainlinkBorrow: Address,
    chainlinkCollateral: Address
): Promise<any> {
    let snapshotId: any;

    before(async () => {
        snapshotId = await network.provider.request({
            method: 'evm_snapshot',
            params: [],
        });
    });

    after(async () => {
        await network.provider.request({
            method: 'evm_revert',
            params: [snapshotId],
        });
    });

    describe('Pool Margin calls', async () => {
        let env: Environment;
        let pool: Pool;
        let poolAddress: Address;

        let deployHelper: DeployHelper;
        let borrowAsset: ERC20;
        let collateralAsset: ERC20;
        let iyield: IYield;
        let Compound: CompoundYield;

        const poolParams = {
            poolSize: BigNumber.from(100),
            borrowRate: BigNumber.from(1).mul(BigNumber.from(10).pow(28)),
            collateralAmount: BigNumber.from(amount),
            collateralRatio: BigNumber.from(250).mul(BigNumber.from(10).pow(28)),
            collectionPeriod: 10000,
            loanWithdrawalDuration: 200,
            noOfRepaymentIntervals: 100,
            repaymentInterval: 1000,
        }
        const SCALER = BigNumber.from(10).pow(30);

        before(async () => {
            env = await createEnvironment(
                hre,
                [whaleAccount1, whaleAccount2],
                [
                    { asset: borrowToken, liquidityToken: liquidityBorrowToken },
                    { asset: collateralToken, liquidityToken: liquidityCollateralToken },
                ] as CompoundPair[],
                [] as YearnPair[],
                [
                    { tokenAddress: borrowToken, feedAggregator: chainlinkBorrow },
                    { tokenAddress: collateralToken, feedAggregator: chainlinkCollateral },
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
                    _loanWithdrawalDuration: testPoolFactoryParams._loanWithdrawalDuration,
                    _marginCallDuration: testPoolFactoryParams._marginCallDuration,
                    _gracePeriodPenaltyFraction: testPoolFactoryParams._gracePeriodPenaltyFraction,
                    _poolInitFuncSelector: getPoolInitSigHash(),
                    _liquidatorRewardFraction: testPoolFactoryParams._liquidatorRewardFraction,
                    _poolCancelPenalityFraction: testPoolFactoryParams._poolCancelPenalityFraction,
                    _protocolFeeFraction: testPoolFactoryParams._protocolFeeFraction,
                    protocolFeeCollector: '',
                    _minBorrowFraction: testPoolFactoryParams._minborrowFraction,
                    noStrategy: '',
                } as PoolFactoryInitParams,
                CreditLineDefaultStrategy.Compound,
                {
                    _protocolFeeFraction: creditLineFactoryParams._protocolFeeFraction,
                    _liquidatorRewardFraction: creditLineFactoryParams._liquidatorRewardFraction,
                } as CreditLineInitParams
            );

            let salt = sha256(Buffer.from(`borrower-${new Date().valueOf()}`));
            let { admin, borrower, lender } = env.entities;
            deployHelper = new DeployHelper(admin);
            borrowAsset = await deployHelper.mock.getMockERC20Detailed(borrowToken);
            collateralAsset = await deployHelper.mock.getMockERC20Detailed(collateralToken);
            iyield = await deployHelper.mock.getYield(env.yields.compoundYield.address);

            let BTDecimals = await borrowAsset.decimals();
            let CTDecimals = await collateralAsset.decimals();

            poolParams.poolSize = BigNumber.from(poolParams.poolSize).mul(BigNumber.from(10).pow(BTDecimals));
            poolParams.collateralAmount = BigNumber.from(poolParams.collateralAmount).mul(BigNumber.from(10).pow(CTDecimals));

            poolAddress = await calculateNewPoolAddress(env, borrowAsset, collateralAsset, iyield, salt, false, {
                _poolSize: poolParams.poolSize,
                _borrowRate: poolParams.borrowRate,
                _collateralAmount: poolParams.collateralAmount,
                _collateralRatio: poolParams.collateralRatio,
                _collectionPeriod: poolParams.collectionPeriod,
                _loanWithdrawalDuration: poolParams.loanWithdrawalDuration,
                _noOfRepaymentIntervals: poolParams.noOfRepaymentIntervals,
                _repaymentInterval: poolParams.repaymentInterval,
            });

            await collateralAsset
                .connect(env.impersonatedAccounts[0])
                .transfer(borrower.address, poolParams.collateralAmount.mul(BigNumber.from(10).pow(CTDecimals)));
            await collateralAsset
                .connect(borrower)
                .approve(poolAddress, poolParams.collateralAmount.mul(BigNumber.from(10).pow(CTDecimals)));

            // Note: Transferring 3 times the poolSize to lender from whale
            await borrowAsset
                .connect(env.impersonatedAccounts[0])
                .transfer(lender.address, poolParams.poolSize.mul(3).mul(BigNumber.from(10).pow(BTDecimals)));

            pool = await createNewPool(env, borrowAsset, collateralAsset, iyield, salt, false, {
                _poolSize: poolParams.poolSize,
                _borrowRate: poolParams.borrowRate,
                _collateralAmount: poolParams.collateralAmount,
                _collateralRatio: poolParams.collateralRatio,
                _collectionPeriod: poolParams.collectionPeriod,
                _loanWithdrawalDuration: poolParams.loanWithdrawalDuration,
                _noOfRepaymentIntervals: poolParams.noOfRepaymentIntervals,
                _repaymentInterval: poolParams.repaymentInterval,
            });

            assert.equal(poolAddress, pool.address, 'Generated and Actual pool address should match');
        });

        describe("Any extra collateral posted to a lender during margin call belong to the lender", () => {
            before(async () => {
                const minBorrowFraction = await env.poolFactory.minBorrowFraction();
                const minPoolSize = poolParams.poolSize.mul(minBorrowFraction).div(SCALER);
                const lentAmount = minPoolSize.mul(4).div(3);
                await pool.connect(env.entities.lender).lend(env.entities.lender.address, lentAmount, false);

                const { loanStartTime } = await pool.poolConstants();
                await blockTravel(network, parseInt(loanStartTime.add(1).toString()));
                await pool.connect(env.entities.borrower).withdrawBorrowedAmount();
            });

            beforeEach(async () => {
                await env.priceOracle.connect(env.entities.admin).setChainlinkFeedAddress(borrowAsset.address, ChainLinkAggregators['ETH/USD']);
            });

            afterEach(async () => {
                await env.priceOracle.connect(env.entities.admin).setChainlinkFeedAddress(borrowAsset.address, chainlinkBorrow);
            });

            it("margin call made", async () => {
                
            });
        });
    });
}