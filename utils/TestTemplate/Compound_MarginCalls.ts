import { calculateNewPoolAddress, createEnvironment, createNewPool } from '../createEnv';
import {
    CompoundPair,
    CreditLineDefaultStrategy,
    CreditLineInitParams,
    Environment,
    ExtensionInitParams,
    // PoolCreateParams,
    PoolFactoryInitParams,
    PriceOracleSource,
    RepaymentsInitParams,
    YearnPair,
} from '../types';
import hre from 'hardhat';
const { ethers, network } = hre;
import { expect, assert } from 'chai';

import {
    extensionParams,
    repaymentParams,
    testPoolFactoryParams,
    createPoolParams,
    zeroAddress,
    ChainLinkAggregators,
} from '../constants-Additions';

import DeployHelper from '../deploys';
import { ERC20 } from '../../typechain/ERC20';
import { sha256 } from '@ethersproject/sha2';
import { BigNumber, BigNumberish } from 'ethers';
import { IYield } from '@typechain/IYield';
import { Address } from 'hardhat-deploy/dist/types';
import { Pool } from '@typechain/Pool';
import { PoolToken } from '@typechain/PoolToken';
import { CompoundYield } from '@typechain/CompoundYield';
import { expectApproxEqual } from '../helpers';
import { incrementChain, timeTravel, blockTravel } from '../../utils/time';

export async function compound_MarginCalls(
    Amount: Number,
    WhaleAccount1: Address,
    WhaleAccount2: Address,
    BorrowToken: Address,
    CollateralToken: Address,
    liquidityBorrowToken: Address,
    liquidityCollateralToken: Address,
    chainlinkBorrow: Address,
    ChainlinkCollateral: Address
): Promise<any> {
    describe('Pool Simulation: Margin Calls', async () => {
        let env: Environment;
        let pool: Pool;
        let poolAddress: Address;
        let poolToken: PoolToken;

        let deployHelper: DeployHelper;
        let BorrowAsset: ERC20;
        let CollateralAsset: ERC20;
        let iyield: IYield;
        let Compound: CompoundYield;

        before(async () => {
            env = await createEnvironment(
                hre,
                [WhaleAccount1, WhaleAccount2],
                [
                    { asset: BorrowToken, liquidityToken: liquidityBorrowToken },
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

            let BTDecimals = await env.mockTokenContracts[0].contract.decimals();
            let CTDecimals = await env.mockTokenContracts[1].contract.decimals();

            poolAddress = await calculateNewPoolAddress(env, BorrowAsset, CollateralAsset, iyield, salt, false, {
                _poolSize: BigNumber.from(100).mul(BigNumber.from(10).pow(BTDecimals)),
                _minborrowAmount: BigNumber.from(10).mul(BigNumber.from(10).pow(BTDecimals)),
                _borrowRate: BigNumber.from(1).mul(BigNumber.from(10).pow(28)),
                _collateralAmount: BigNumber.from(Amount).mul(BigNumber.from(10).pow(CTDecimals)),
                // _collateralAmount: BigNumber.from(1).mul(BigNumber.from(10).pow(CTDecimals)),
                _collateralRatio: BigNumber.from(250).mul(BigNumber.from(10).pow(28)),
                _collectionPeriod: 10000,
                _matchCollateralRatioInterval: 200,
                _noOfRepaymentIntervals: 100,
                _repaymentInterval: 1000,
            });

            // console.log({ calculatedPoolAddress: poolAddress });

            console.log('Borrow Token: ', env.mockTokenContracts[0].name);
            console.log('Collateral Token: ', env.mockTokenContracts[1].name);
            // console.log(await env.mockTokenContracts[0].contract.decimals());
            // console.log(await env.mockTokenContracts[1].contract.decimals());

            await env.mockTokenContracts[1].contract
                .connect(env.impersonatedAccounts[0])
                .transfer(admin.address, BigNumber.from(Amount).mul(BigNumber.from(10).pow(CTDecimals)));
            await env.mockTokenContracts[1].contract
                .connect(admin)
                .transfer(borrower.address, BigNumber.from(Amount).mul(BigNumber.from(10).pow(CTDecimals)));
            await env.mockTokenContracts[1].contract
                .connect(borrower)
                .approve(poolAddress, BigNumber.from(Amount).mul(BigNumber.from(10).pow(CTDecimals)));

            // console.log("Tokens present!");
            pool = await createNewPool(env, BorrowAsset, CollateralAsset, iyield, salt, false, {
                _poolSize: BigNumber.from(100).mul(BigNumber.from(10).pow(BTDecimals)),
                _minborrowAmount: BigNumber.from(10).mul(BigNumber.from(10).pow(BTDecimals)),
                _borrowRate: BigNumber.from(1).mul(BigNumber.from(10).pow(28)),
                _collateralAmount: BigNumber.from(Amount).mul(BigNumber.from(10).pow(CTDecimals)),
                // _collateralAmount: BigNumber.from(1).mul(BigNumber.from(10).pow(CTDecimals)),
                _collateralRatio: BigNumber.from(250).mul(BigNumber.from(10).pow(28)),
                _collectionPeriod: 10000,
                _matchCollateralRatioInterval: 200,
                _noOfRepaymentIntervals: 100,
                _repaymentInterval: 1000,
            });

            // console.log({ actualPoolAddress: pool.address });

            let poolTokenAddress = await pool.poolToken(); //Getting the address of the pool token

            poolToken = await deployHelper.pool.getPoolToken(poolTokenAddress);

            expect(await poolToken.name()).eq('Open Borrow Pool Tokens');
            expect(await poolToken.symbol()).eq('OBPT');
            expect(await poolToken.decimals()).eq(18);

            assert.equal(poolAddress, pool.address, 'Generated and Actual pool address should match');

            let borrowToken = env.mockTokenContracts[0].contract;
            let minBorrowAmount = BigNumber.from(10).mul(BigNumber.from(10).pow(BTDecimals));
            let amount = minBorrowAmount.add(10).mul(2).div(3);
            let amount1 = minBorrowAmount.div(3);
            // console.log(amount.toString());
            // console.log(amount1.toString());
            let lender1 = env.entities.extraLenders[3];

            // Approving Borrow tokens to the lender
            await borrowToken.connect(env.impersonatedAccounts[1]).transfer(admin.address, amount);
            await borrowToken.connect(admin).transfer(lender.address, amount);
            await borrowToken.connect(lender).approve(poolAddress, amount);
            // console.log('1st Lender approved!');

            // Lender lends into the pool
            const lendExpect = expect(pool.connect(lender).lend(lender.address, amount, false));
            await lendExpect.to.emit(pool, 'LiquiditySupplied').withArgs(amount, lender.address);
            await lendExpect.to.emit(poolToken, 'Transfer').withArgs(zeroAddress, lender.address, amount);

            // Approving Borrow tokens to the lender1
            await borrowToken.connect(env.impersonatedAccounts[1]).transfer(admin.address, amount1);
            await borrowToken.connect(admin).transfer(lender1.address, amount1);
            await borrowToken.connect(lender1).approve(poolAddress, amount1);
            // console.log('2nd Lender approved!');

            // Lender1 lends into the pool
            const lendExpect1 = expect(pool.connect(lender1).lend(lender1.address, amount1, false));
            await lendExpect1.to.emit(pool, 'LiquiditySupplied').withArgs(amount1, lender1.address);
            await lendExpect1.to.emit(poolToken, 'Transfer').withArgs(zeroAddress, lender1.address, amount1);

            //block travel to escape withdraw interval
            const { loanStartTime } = await pool.poolConstants();
            await blockTravel(network, parseInt(loanStartTime.add(1).toString()));

            // Borrower withdraws borrow tokens
            await pool.connect(borrower).withdrawBorrowedAmount();
        });

        it('Lender should not be able to request margin call if price has not reached threshold', async function () {
            let { admin, borrower, lender } = env.entities;
            // Requesting margin call
            await expect(pool.connect(lender).requestMarginCall()).to.be.revertedWith('26');
        });

        it('Lender should be able to request margin call only if the price goes down', async function () {
            let { admin, borrower, lender } = env.entities;
            let lender1 = env.entities.extraLenders[3];
            let collateralToken = env.mockTokenContracts[1].contract;

            // Reducing the collateral ratio
            await env.priceOracle.connect(admin).setChainlinkFeedAddress(BorrowToken, ChainLinkAggregators['BTC/USD']);

            // Requesting margin call
            await pool.connect(lender1).requestMarginCall();

            // Setting the collateral ratio to correct value
            await env.priceOracle.connect(admin).setChainlinkFeedAddress(BorrowToken, chainlinkBorrow);
        });

        it('Any user should be able to liquidate margin call if call is not answered in time', async function () {
            let { admin, borrower, lender } = env.entities;
            let random = env.entities.extraLenders[10];
            let borrowToken = env.mockTokenContracts[0].contract;
            let collateralToken = env.mockTokenContracts[1].contract;

            // Setting a lower collateral ratio and requesting for margin call
            await env.priceOracle.connect(admin).setChainlinkFeedAddress(BorrowToken, ChainLinkAggregators['BTC/USD']);
            await pool.connect(lender).requestMarginCall();

            await timeTravel(network, parseInt(testPoolFactoryParams._marginCallDuration.toString()));

            const liquidationTokens = await poolToken.balanceOf(lender.address);
            let borrowTokenBefore = await borrowToken.balanceOf(lender.address);

            let randomCollateralBefore = await collateralToken.balanceOf(random.address);
            // console.log(liquidationTokens.toString());
            await borrowToken.connect(env.impersonatedAccounts[1]).transfer(admin.address, liquidationTokens.mul(2));
            await borrowToken.connect(admin).transfer(random.address, liquidationTokens.mul(2));
            await borrowToken.connect(random).approve(pool.address, liquidationTokens.mul(2));

            // Liquidate lender after margin call duration is over
            let liquidateExpect = expect(pool.connect(random).liquidateLender(lender.address, false, false, false));
            await liquidateExpect.to.emit(pool, 'LenderLiquidated');

            let lenderPoolTokenAfter = await poolToken.balanceOf(lender.address);
            let collateralTokenAfter = await collateralToken.balanceOf(lender.address);
            let randomCollateral = await collateralToken.balanceOf(random.address);

            assert(
                lenderPoolTokenAfter.toString() == BigNumber.from('0').toString(),
                `Lender not liquidated Properly. Actual ${lenderPoolTokenAfter.toString()} Expected ${BigNumber.from('0').toString()}`
            );

            // Before Liquidation
            console.log('BorrowToken Before', borrowTokenBefore.toString());

            // After Liquidation
            console.log('PoolToken After', lenderPoolTokenAfter.toString()); // Should be 0
            console.log('CollateralToken After', collateralTokenAfter.toString());

            // Random
            console.log('CollateralToken Random Before', randomCollateralBefore.toString());
            console.log('CollateralToken Random', randomCollateral.toString());

            await env.priceOracle.connect(admin).setChainlinkFeedAddress(BorrowToken, chainlinkBorrow);
        });
    });
}
