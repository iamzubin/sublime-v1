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
    creditLineFactoryParams,
    WhaleAccount,
    zeroAddress,
    ChainLinkAggregators,
} from '../constants';

import DeployHelper from '../deploys';
import { ERC20 } from '../../typechain/ERC20';
import { sha256 } from '@ethersproject/sha2';
import { BigNumber, BigNumberish } from 'ethers';
import { IYield } from '@typechain/IYield';
import { Address } from 'hardhat-deploy/dist/types';
import { Pool } from '@typechain/Pool';
import { getPoolInitSigHash } from '../../utils/createEnv/poolLogic';
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
            BorrowAsset = await deployHelper.mock.getMockERC20(env.mockTokenContracts[0].contract.address);
            CollateralAsset = await deployHelper.mock.getMockERC20(env.mockTokenContracts[1].contract.address);
            iyield = await deployHelper.mock.getYield(env.yields.compoundYield.address);

            let BTDecimals = await env.mockTokenContracts[0].contract.decimals();
            let CTDecimals = await env.mockTokenContracts[1].contract.decimals();

            poolAddress = await calculateNewPoolAddress(env, BorrowAsset, CollateralAsset, iyield, salt, false, {
                _poolSize: BigNumber.from(100).mul(BigNumber.from(10).pow(BTDecimals)),
                _borrowRate: BigNumber.from(1).mul(BigNumber.from(10).pow(28)),
                _collateralAmount: BigNumber.from(Amount).mul(BigNumber.from(10).pow(CTDecimals)),
                // _collateralAmount: BigNumber.from(1).mul(BigNumber.from(10).pow(CTDecimals)),
                _collateralRatio: BigNumber.from(250).mul(BigNumber.from(10).pow(28)),
                _collectionPeriod: 10000,
                _loanWithdrawalDuration: 200,
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
                _borrowRate: BigNumber.from(1).mul(BigNumber.from(10).pow(28)),
                _collateralAmount: BigNumber.from(Amount).mul(BigNumber.from(10).pow(CTDecimals)),
                // _collateralAmount: BigNumber.from(1).mul(BigNumber.from(10).pow(CTDecimals)),
                _collateralRatio: BigNumber.from(250).mul(BigNumber.from(10).pow(28)),
                _collectionPeriod: 10000,
                _loanWithdrawalDuration: 200,
                _noOfRepaymentIntervals: 100,
                _repaymentInterval: 1000,
            });

            // console.log({ actualPoolAddress: pool.address });

            assert.equal(poolAddress, pool.address, 'Generated and Actual pool address should match');

            let borrowToken = env.mockTokenContracts[0].contract;
            let collateralToken = env.mockTokenContracts[1].contract;
            let minBorrowAmount = BigNumber.from(10).mul(BigNumber.from(10).pow(BTDecimals));
            let amount = minBorrowAmount.mul(2).div(3);
            let amount1 = minBorrowAmount.add(10).div(3);

            let lender1 = env.entities.extraLenders[3];

            // Approving Borrow tokens to the lender
            await borrowToken.connect(env.impersonatedAccounts[1]).transfer(admin.address, amount);
            await borrowToken.connect(admin).transfer(lender.address, amount);
            await borrowToken.connect(lender).approve(poolAddress, amount);

            // Lender lends into the pool
            const lendExpect = expect(pool.connect(lender).lend(lender.address, amount, false));
            await lendExpect.to.emit(pool, 'LiquiditySupplied').withArgs(amount, lender.address);
            await lendExpect.to.emit(pool, 'Transfer').withArgs(zeroAddress, lender.address, amount);

            // Approving Borrow tokens to the lender1
            await borrowToken.connect(env.impersonatedAccounts[1]).transfer(admin.address, amount1);
            await borrowToken.connect(admin).transfer(lender1.address, amount1);
            await borrowToken.connect(lender1).approve(poolAddress, amount1);

            // Lender1 lends into the pool
            const lendExpect1 = expect(pool.connect(lender1).lend(lender1.address, amount1, false));
            await lendExpect1.to.emit(pool, 'LiquiditySupplied').withArgs(amount1, lender1.address);
            await lendExpect1.to.emit(pool, 'Transfer').withArgs(zeroAddress, lender1.address, amount1);

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
            // Reducing the collateral ratio
            await env.priceOracle.connect(admin).setChainlinkFeedAddress(BorrowToken, ChainLinkAggregators['BTC/USD']);

            // Requesting margin call
            await pool.connect(lender).requestMarginCall();

            // Setting the collateral ratio to correct value
            await env.priceOracle.connect(admin).setChainlinkFeedAddress(BorrowToken, chainlinkBorrow);
        });

        it('Any user should be able to liquidate margin call if call is not answered in time', async function () {
            let { admin, borrower, lender } = env.entities;
            let random = env.entities.extraLenders[10];
            let borrowToken = env.mockTokenContracts[0].contract;
            let collateralToken = env.mockTokenContracts[1].contract;
            let strategy = env.yields.compoundYield.address;

            // Setting a lower collateral ratio and requesting for margin call
            await env.priceOracle.connect(admin).setChainlinkFeedAddress(BorrowToken, ChainLinkAggregators['BTC/USD']);
            // await pool.connect(lender).requestMarginCall();

            await timeTravel(network, parseInt(testPoolFactoryParams._marginCallDuration.toString()));

            // Balance check before liquidation
            let lenderBorrowTokenBefore = await borrowToken.balanceOf(lender.address);
            let randomCollateralBefore = await collateralToken.balanceOf(random.address);
            let collateralBalancePoolBefore = await env.savingsAccount
                .connect(admin)
                .balanceInShares(pool.address, collateralToken.address, strategy);
            // console.log({collateralBalancePoolBefore: collateralBalancePoolBefore.toString()});

            const liquidationTokens = await pool.balanceOf(lender.address);
            // console.log({LiquidationToken: liquidationTokens.toString()});
            await borrowToken.connect(env.impersonatedAccounts[1]).transfer(admin.address, liquidationTokens.mul(2));
            await borrowToken.connect(admin).transfer(random.address, liquidationTokens.mul(2));
            await borrowToken.connect(random).approve(pool.address, liquidationTokens.mul(2));

            // Liquidate lender after margin call duration is over
            let liquidateExpect = expect(pool.connect(random).liquidateForLender(lender.address, false, false, false));
            await liquidateExpect.to.emit(pool, 'LenderLiquidated');

            // Balance check after liquidation
            let lenderBorrowTokenAfter = await borrowToken.balanceOf(lender.address);
            let randomCollateralAfter = await collateralToken.balanceOf(random.address);
            let lenderPoolTokenAfter = await pool.balanceOf(lender.address);
            let collateralBalancePoolAfter = await env.savingsAccount
                .connect(admin)
                .balanceInShares(pool.address, collateralToken.address, strategy);

            // The pool Token balance of the lender should be zero after liquidation
            assert(
                lenderPoolTokenAfter.toString() == BigNumber.from('0').toString(),
                `Lender not liquidated Properly. Actual ${lenderPoolTokenAfter.toString()} Expected ${BigNumber.from('0').toString()}`
            );

            // Getting the Collateral Token balance of the pool
            let collateralBalancePoolDif = collateralBalancePoolBefore.sub(collateralBalancePoolAfter);
            // console.log({collateralBalancePoolDif: collateralBalancePoolDif.toString()});

            let collateralTokenBalance = await env.yields.compoundYield.callStatic.getTokensForShares(
                collateralBalancePoolDif,
                collateralToken.address
            );
            // console.log({ collateralTokenBalance: collateralTokenBalance.toString() });

            // Checking for correct liquidator reward
            let rewardReceived = randomCollateralAfter.sub(randomCollateralBefore);
            // console.log({ rewardReceived: rewardReceived.toString() });

            expectApproxEqual(collateralTokenBalance, rewardReceived, 10);

            // Checking the Borrow Tokens received by Lender
            let LenderReturn = lenderBorrowTokenAfter.sub(lenderBorrowTokenBefore);
            // console.log({LenderReturn: LenderReturn.toString()});

            await env.priceOracle.connect(admin).setChainlinkFeedAddress(BorrowToken, chainlinkBorrow);
        });

        it('When all lenders request margin call, there should be no collateral left in pool', async function () {
            let { admin, borrower, lender } = env.entities;
            let lender1 = env.entities.extraLenders[3];
            let random = env.entities.extraLenders[10];
            let borrowToken = env.mockTokenContracts[0].contract;
            let collateralToken = env.mockTokenContracts[1].contract;
            let strategy = env.yields.compoundYield.address;

            // Setting a lower collateral ratio and requesting for margin call
            await env.priceOracle.connect(admin).setChainlinkFeedAddress(BorrowToken, ChainLinkAggregators['BTC/USD']);
            await pool.connect(lender1).requestMarginCall();

            await timeTravel(network, parseInt(testPoolFactoryParams._marginCallDuration.toString()));

            const liquidationTokens = await pool.balanceOf(lender1.address);
            // console.log({LiquidationToken: liquidationTokens.toString()});
            await borrowToken.connect(env.impersonatedAccounts[1]).transfer(admin.address, liquidationTokens.mul(2));
            await borrowToken.connect(admin).transfer(random.address, liquidationTokens.mul(2));
            // await borrowToken.connect(random).approve(pool.address, liquidationTokens.mul(2));

            // Liquidate lender after margin call duration is over
            let liquidateExpect = expect(pool.connect(random).liquidateForLender(lender1.address, false, false, false));
            await liquidateExpect.to.emit(pool, 'LenderLiquidated');

            let collateralBalancePoolAfter = await env.savingsAccount
                .connect(admin)
                .balanceInShares(pool.address, collateralToken.address, strategy);
            // console.log({collateralBalancePoolAfter: collateralBalancePoolAfter.toString()});

            expectApproxEqual(collateralBalancePoolAfter, 0, 100);

            await env.priceOracle.connect(admin).setChainlinkFeedAddress(BorrowToken, chainlinkBorrow);
        });
    });
}
