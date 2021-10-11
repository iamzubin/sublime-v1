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

import { extensionParams, repaymentParams, testPoolFactoryParams, zeroAddress, creditLineFactoryParams } from '../constants-Additions';

import DeployHelper from '../deploys';
import { ERC20 } from '../../typechain/ERC20';
import { sha256 } from '@ethersproject/sha2';
import { BigNumber } from 'ethers';
import { IYield } from '@typechain/IYield';
import { Address } from 'hardhat-deploy/dist/types';
import { Pool } from '@typechain/Pool';
import { PoolToken } from '@typechain/PoolToken';
import { expectApproxEqual } from '../helpers';
import { incrementChain, timeTravel, blockTravel } from '../../utils/time';

export async function yearnPoolCollectionStage(
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
    describe('Pool Simulation: Collection Stage', async () => {
        let env: Environment;
        let pool: Pool;
        let poolAddress: Address;
        let poolToken: PoolToken;

        let deployHelper: DeployHelper;
        let BorrowAsset: ERC20;
        let CollateralAsset: ERC20;
        let iyield: IYield;

        before(async () => {
            env = await createEnvironment(
                hre,
                [WhaleAccount1, WhaleAccount2],
                [] as CompoundPair[],
                [
                    { asset: BorrowToken, liquidityToken: liquidityBorrowToken },
                    { asset: CollateralToken, liquidityToken: liquidityCollateralToken },
                ] as YearnPair[],
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
                    _poolInitFuncSelector: testPoolFactoryParams._poolInitFuncSelector,
                    _poolTokenInitFuncSelector: testPoolFactoryParams._poolTokenInitFuncSelector,
                    _liquidatorRewardFraction: testPoolFactoryParams._liquidatorRewardFraction,
                    _poolCancelPenalityFraction: testPoolFactoryParams._poolCancelPenalityFraction,
                    _protocolFeeFraction: testPoolFactoryParams._protocolFeeFraction,
                    protocolFeeCollector: '',
                    _minBorrowFraction: testPoolFactoryParams._minborrowFraction,
                } as PoolFactoryInitParams,
                CreditLineDefaultStrategy.Yearn,
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
            iyield = await deployHelper.mock.getYield(env.yields.yearnYield.address);

            let BTDecimals = await env.mockTokenContracts[0].contract.decimals();
            let CTDecimals = await env.mockTokenContracts[1].contract.decimals();

            poolAddress = await calculateNewPoolAddress(env, BorrowAsset, CollateralAsset, iyield, salt, false, {
                _poolSize: BigNumber.from(100).mul(BigNumber.from(10).pow(BTDecimals)),
                _volatilityThreshold: BigNumber.from(20).mul(BigNumber.from(10).pow(28)),
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
                _volatilityThreshold: BigNumber.from(20).mul(BigNumber.from(10).pow(28)),
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

            let poolTokenAddress = await pool.poolToken(); //Getting the address of the pool token

            poolToken = await deployHelper.pool.getPoolToken(poolTokenAddress);

            expect(await poolToken.name()).eq('Pool Tokens');
            expect(await poolToken.symbol()).eq('OBPT');
            expect(await poolToken.decimals()).eq(18);

            assert.equal(poolAddress, pool.address, 'Generated and Actual pool address should match');
        });

        it('Borrower should be able to directly add more Collateral to the pool', async function () {
            let { admin, borrower, lender } = env.entities;
            let CTDecimals = await env.mockTokenContracts[1].contract.decimals();
            let Collateral = env.mockTokenContracts[1].contract.address;
            let depositAmount = BigNumber.from(1).mul(BigNumber.from(10).pow(CTDecimals));

            // Transfering again as the initial amount was used for initial deposit
            await env.mockTokenContracts[1].contract.connect(env.impersonatedAccounts[0]).transfer(admin.address, depositAmount);
            await env.mockTokenContracts[1].contract.connect(admin).transfer(borrower.address, depositAmount);
            await env.mockTokenContracts[1].contract.connect(borrower).approve(poolAddress, depositAmount);

            // Checking balance before deposit
            let SharesBefore = (await pool.poolVariables()).baseLiquidityShares;

            // Direct Collateral deposit
            await pool.connect(borrower).depositCollateral(depositAmount, false);

            // Checking balance after deposit
            let SharesAfter = (await pool.poolVariables()).baseLiquidityShares;

            // Getting additional Shares
            let SharesReceived = SharesAfter.sub(SharesBefore);
            // console.log({SharesReceived: SharesReceived.toNumber()});

            // Checking shares received and matching with the deposited amount
            console.log('Liquidity Shares');
            let liquidityShares = await env.yields.yearnYield.callStatic.getSharesForTokens(depositAmount, Collateral);
            console.log({ LiquidityShares: liquidityShares.toNumber() });
            expectApproxEqual(liquidityShares.toNumber(), SharesReceived, 50);

            let LoanStatus = (await pool.poolVars()).loanStatus;
            // console.log(LoanStatus);
            assert(
                LoanStatus.toString() == BigNumber.from('0').toString(),
                `Pool not terminated correctly. Expected: ${BigNumber.from('0').toString()} 
                Actual: ${LoanStatus}`
            );
        });

        it('Borrower should be able to deposit Collateral to the pool using Savings Account', async function () {
            let { admin, borrower, lender } = env.entities;
            let CTDecimals = await env.mockTokenContracts[1].contract.decimals();
            let Collateral = await env.mockTokenContracts[1].contract;
            let depositAmount = BigNumber.from(1).mul(BigNumber.from(10).pow(CTDecimals));
            let AmountForDeposit = BigNumber.from(100);

            let liquidityShares = await env.yields.yearnYield.callStatic.getTokensForShares(AmountForDeposit, Collateral.address);
            // console.log({ LiquidityShares: liquidityShares.toString() });
            // console.log({ DepositAmount: AmountForDeposit.toString() });

            // Transfering again as the initial amount was used for initial deposit
            await Collateral.connect(env.impersonatedAccounts[0]).transfer(admin.address, depositAmount);
            await Collateral.connect(admin).transfer(borrower.address, depositAmount);
            await Collateral.connect(borrower).approve(env.yields.yearnYield.address, liquidityShares.mul(100));

            // Approving the Savings Account for deposit of tokens
            await env.savingsAccount.connect(borrower).approve(liquidityShares.mul(100), Collateral.address, pool.address);
            await env.savingsAccount
                .connect(borrower)
                .deposit(liquidityShares.mul(100), Collateral.address, env.yields.yearnYield.address, borrower.address);

            // Checking balance before deposit
            let SharesBefore = (await pool.poolVariables()).baseLiquidityShares;

            // Depositing Tokens
            await expect(pool.connect(borrower).depositCollateral(AmountForDeposit, true)).to.emit(env.savingsAccount, 'Transfer');

            // Checking balance after deposit
            let SharesAfter = (await pool.poolVariables()).baseLiquidityShares;

            // Getting additional Shares
            let SharesReceived = SharesAfter.sub(SharesBefore);
            // console.log({SharesReceived: SharesReceived.toNumber()});

            // Checking shares received and matching with the deposited amount
            expectApproxEqual(SharesReceived, AmountForDeposit, 50);
        });

        it('Lender should be able to lend the borrow tokens directly to the pool', async function () {
            let { admin, borrower, lender } = env.entities;
            let BTDecimals = await env.mockTokenContracts[0].contract.decimals();

            const amount = BigNumber.from(10).mul(BigNumber.from(10).pow(BTDecimals));
            const poolTokenBalanceBefore = await poolToken.balanceOf(lender.address);
            const poolTokenTotalSupplyBefore = await poolToken.totalSupply();

            //Lenders can lend borrow Tokens into the pool
            await env.mockTokenContracts[0].contract.connect(env.impersonatedAccounts[1]).transfer(admin.address, amount);
            await env.mockTokenContracts[0].contract.connect(admin).transfer(lender.address, amount);
            await env.mockTokenContracts[0].contract.connect(lender).approve(poolAddress, amount);

            const lendExpect = expect(pool.connect(lender).lend(lender.address, amount, false));
            await lendExpect.to.emit(pool, 'LiquiditySupplied').withArgs(amount, lender.address);
            await lendExpect.to.emit(poolToken, 'Transfer').withArgs(zeroAddress, lender.address, amount);

            const poolTokenBalanceAfter = await poolToken.balanceOf(lender.address);
            const poolTokenTotalSupplyAfter = await poolToken.totalSupply();
            assert(
                poolTokenBalanceAfter.toString() == poolTokenBalanceBefore.add(amount).toString(),
                `Pool tokens not minted correctly. amount: ${amount} Expected: ${poolTokenBalanceBefore.add(
                    amount
                )} Actual: ${poolTokenBalanceAfter}`
            );
            assert(
                poolTokenTotalSupplyAfter.toString() == poolTokenTotalSupplyBefore.add(amount).toString(),
                `Pool token supply not correct. amount: ${amount} Expected: ${poolTokenTotalSupplyBefore.add(
                    amount
                )} Actual: ${poolTokenTotalSupplyBefore}`
            );
        });

        it('Lender should be able to lend the borrow tokens with same account in savingsAccount to the pool', async function () {
            let { admin, borrower, lender } = env.entities;
            let BTDecimals = await env.mockTokenContracts[0].contract.decimals();

            const amount = BigNumber.from(10).mul(BigNumber.from(10).pow(BTDecimals));
            const poolTokenBalanceBefore = await poolToken.balanceOf(lender.address);
            const poolTokenTotalSupplyBefore = await poolToken.totalSupply();

            //Lenders can lend borrow Tokens into the pool
            await env.mockTokenContracts[0].contract.connect(env.impersonatedAccounts[1]).transfer(admin.address, amount);
            await env.mockTokenContracts[0].contract.connect(admin).transfer(lender.address, amount);
            await env.mockTokenContracts[0].contract.connect(lender).approve(env.savingsAccount.address, amount);
            await env.savingsAccount
                .connect(lender)
                .deposit(amount, env.mockTokenContracts[0].contract.address, zeroAddress, lender.address);
            await env.savingsAccount.connect(lender).approve(amount, env.mockTokenContracts[0].contract.address, pool.address);

            const lendExpect = expect(pool.connect(lender).lend(lender.address, amount, true));
            await lendExpect.to.emit(pool, 'LiquiditySupplied').withArgs(amount, lender.address);
            await lendExpect.to.emit(poolToken, 'Transfer').withArgs(zeroAddress, lender.address, amount);

            const poolTokenBalanceAfter = await poolToken.balanceOf(lender.address);
            const poolTokenTotalSupplyAfter = await poolToken.totalSupply();
            assert(
                poolTokenBalanceAfter.toString() == poolTokenBalanceBefore.add(amount).toString(),
                `Pool tokens not minted correctly. amount: ${amount} Expected: ${poolTokenBalanceBefore.add(
                    amount
                )} Actual: ${poolTokenBalanceAfter}`
            );
            assert(
                poolTokenTotalSupplyAfter.toString() == poolTokenTotalSupplyBefore.add(amount).toString(),
                `Pool token supply not correct. amount: ${amount} Expected: ${poolTokenTotalSupplyBefore.add(
                    amount
                )} Actual: ${poolTokenTotalSupplyBefore}`
            );
        });

        it('Lender should be able to lend the borrow tokens different account in savingsAccount to the pool', async function () {
            let { admin, borrower, lender } = env.entities;
            let lender1 = env.entities.extraLenders[10];
            let BTDecimals = await env.mockTokenContracts[0].contract.decimals();

            const amount = BigNumber.from(10).mul(BigNumber.from(10).pow(BTDecimals));
            const poolTokenBalanceBefore = await poolToken.balanceOf(lender.address);
            const poolTokenTotalSupplyBefore = await poolToken.totalSupply();

            //Lenders can lend borrow Tokens into the pool
            await env.mockTokenContracts[0].contract.connect(env.impersonatedAccounts[1]).transfer(admin.address, amount);
            await env.mockTokenContracts[0].contract.connect(admin).transfer(lender1.address, amount);
            await env.mockTokenContracts[0].contract.connect(lender1).approve(env.savingsAccount.address, amount);
            await env.savingsAccount
                .connect(lender1)
                .deposit(amount, env.mockTokenContracts[0].contract.address, zeroAddress, lender1.address);
            await env.savingsAccount.connect(lender1).approve(amount, env.mockTokenContracts[0].contract.address, pool.address);

            const lendExpect = expect(pool.connect(lender1).lend(lender.address, amount, true));
            await lendExpect.to.emit(pool, 'LiquiditySupplied').withArgs(amount, lender.address);
            await lendExpect.to.emit(poolToken, 'Transfer').withArgs(zeroAddress, lender.address, amount);

            const poolTokenBalanceAfter = await poolToken.balanceOf(lender.address);
            const poolTokenTotalSupplyAfter = await poolToken.totalSupply();
            assert(
                poolTokenBalanceAfter.toString() == poolTokenBalanceBefore.add(amount).toString(),
                `Pool tokens not minted correctly. amount: ${amount} Expected: ${poolTokenBalanceBefore.add(
                    amount
                )} Actual: ${poolTokenBalanceAfter}`
            );
            assert(
                poolTokenTotalSupplyAfter.toString() == poolTokenTotalSupplyBefore.add(amount).toString(),
                `Pool token supply not correct. amount: ${amount} Expected: ${poolTokenTotalSupplyBefore.add(
                    amount
                )} Actual: ${poolTokenTotalSupplyBefore}`
            );
        });
    });

    xdescribe('Pool Simulations: Active Stage', async () => {
        let env: Environment;
        let pool: Pool;
        let poolAddress: Address;
        let poolToken: PoolToken;

        let deployHelper: DeployHelper;
        let BorrowAsset: ERC20;
        let CollateralAsset: ERC20;
        let iyield: IYield;

        const scaler = BigNumber.from('10').pow(30);

        before(async () => {
            env = await createEnvironment(
                hre,
                [WhaleAccount1, WhaleAccount2],
                [] as CompoundPair[],
                [
                    { asset: BorrowToken, liquidityToken: liquidityBorrowToken },
                    { asset: CollateralToken, liquidityToken: liquidityCollateralToken },
                ] as YearnPair[],
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
                CreditLineDefaultStrategy.Yearn,
                { _protocolFeeFraction: testPoolFactoryParams._protocolFeeFraction } as CreditLineInitParams
            );

            let salt = sha256(Buffer.from(`borrower-${new Date().valueOf()}`));
            let { admin, borrower, lender } = env.entities;
            deployHelper = new DeployHelper(admin);
            BorrowAsset = await deployHelper.mock.getMockERC20(env.mockTokenContracts[0].contract.address);
            CollateralAsset = await deployHelper.mock.getMockERC20(env.mockTokenContracts[1].contract.address);
            iyield = await deployHelper.mock.getYield(env.yields.yearnYield.address);

            let BTDecimals = await env.mockTokenContracts[0].contract.decimals();
            let CTDecimals = await env.mockTokenContracts[1].contract.decimals();

            poolAddress = await calculateNewPoolAddress(env, BorrowAsset, CollateralAsset, iyield, salt, false, {
                _poolSize: BigNumber.from(100).mul(BigNumber.from(10).pow(BTDecimals)),
                _minborrowAmount: BigNumber.from(10).mul(BigNumber.from(10).pow(BTDecimals)),
                _borrowRate: BigNumber.from(1).mul(BigNumber.from(10).pow(28)),
                _collateralAmount: BigNumber.from(Amount).mul(BigNumber.from(10).pow(CTDecimals)),
                _collateralRatio: BigNumber.from(250).mul(BigNumber.from(10).pow(28)),
                _collectionPeriod: 10000,
                _matchCollateralRatioInterval: 200,
                _noOfRepaymentIntervals: 100,
                _repaymentInterval: 1000,
            });

            // console.log({ calculatedPoolAddress: poolAddress });

            // console.log("Borrow Token: ", env.mockTokenContracts[0].name);
            // console.log("Collateral Token: ", env.mockTokenContracts[1].name);

            await env.mockTokenContracts[1].contract
                .connect(env.impersonatedAccounts[0])
                .transfer(admin.address, BigNumber.from(Amount).mul(BigNumber.from(10).pow(CTDecimals)));
            await env.mockTokenContracts[1].contract
                .connect(admin)
                .transfer(borrower.address, BigNumber.from(Amount).mul(BigNumber.from(10).pow(CTDecimals)));
            await env.mockTokenContracts[1].contract
                .connect(borrower)
                .approve(poolAddress, BigNumber.from(Amount).mul(BigNumber.from(10).pow(CTDecimals)));

            pool = await createNewPool(env, BorrowAsset, CollateralAsset, iyield, salt, false, {
                _poolSize: BigNumber.from(100).mul(BigNumber.from(10).pow(BTDecimals)),
                _minborrowAmount: BigNumber.from(10).mul(BigNumber.from(10).pow(BTDecimals)),
                _borrowRate: BigNumber.from(1).mul(BigNumber.from(10).pow(28)),
                _collateralAmount: BigNumber.from(Amount).mul(BigNumber.from(10).pow(CTDecimals)),
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
        });

        // This case is when loan stage returns to withdraw after the withdrawal interval
        xit('Borrower should not be able to withdraw token when amount < minimum borrow amount', async function () {
            let { admin, borrower, lender } = env.entities;
            let BTDecimals = await env.mockTokenContracts[0].contract.decimals();
            let amount = BigNumber.from(1).mul(BigNumber.from(10).pow(BTDecimals)); // 1 Borrow Token

            await env.mockTokenContracts[0].contract.connect(env.impersonatedAccounts[1]).transfer(admin.address, amount);
            await env.mockTokenContracts[0].contract.connect(admin).transfer(lender.address, amount);
            await env.mockTokenContracts[0].contract.connect(lender).approve(poolAddress, amount);

            const lendExpect = expect(pool.connect(lender).lend(lender.address, amount, false));
            await lendExpect.to.emit(pool, 'LiquiditySupplied').withArgs(amount, lender.address);
            await lendExpect.to.emit(poolToken, 'Transfer').withArgs(zeroAddress, lender.address, amount);

            //block travel to escape withdraw interval
            const { loanStartTime } = await pool.poolConstants();
            await blockTravel(network, parseInt(loanStartTime.add(1).toString()));

            await expect(pool.connect(borrower).withdrawBorrowedAmount()).to.revertedWith('');

            let LoanStatus = (await pool.poolVars()).loanStatus;
            assert(
                LoanStatus.toString() == BigNumber.from('0').toString(),
                `Pool should be in Collection Stage. Expected: ${BigNumber.from('0').toString()} 
                Actual: ${LoanStatus}`
            );
        });

        it('Borrower should be able to withdraw token when amount >= minimum borrow amount', async function () {
            let { admin, borrower, lender } = env.entities;
            let BTDecimals = await env.mockTokenContracts[0].contract.decimals();
            let borrowToken = await env.mockTokenContracts[0].contract;
            let amount = BigNumber.from(10).mul(BigNumber.from(10).pow(BTDecimals)); // 10 Borrow Tokens

            await env.mockTokenContracts[0].contract.connect(env.impersonatedAccounts[1]).transfer(admin.address, amount);
            await env.mockTokenContracts[0].contract.connect(admin).transfer(lender.address, amount);
            await env.mockTokenContracts[0].contract.connect(lender).approve(poolAddress, amount);

            const lendExpect = expect(pool.connect(lender).lend(lender.address, amount, false));
            await lendExpect.to.emit(pool, 'LiquiditySupplied').withArgs(amount, lender.address);
            await lendExpect.to.emit(poolToken, 'Transfer').withArgs(zeroAddress, lender.address, amount);

            //block travel to escape withdraw interval
            const { loanStartTime } = await pool.poolConstants();
            await blockTravel(network, parseInt(loanStartTime.add(1).toString()));

            const borrowAssetBalanceBorrower = await borrowToken.balanceOf(borrower.address);
            const borrowAssetBalancePool = await borrowToken.balanceOf(pool.address);

            const borrowAssetBalancePoolSavings = await env.savingsAccount
                .connect(admin)
                .userLockedBalance(pool.address, borrowToken.address, zeroAddress);
            const tokensLent = await poolToken.totalSupply();
            await pool.connect(borrower).withdrawBorrowedAmount();
            const borrowAssetBalanceBorrowerAfter = await borrowToken.balanceOf(borrower.address);
            const borrowAssetBalancePoolAfter = await borrowToken.balanceOf(pool.address);

            const borrowAssetBalancePoolSavingsAfter = await env.savingsAccount
                .connect(admin)
                .userLockedBalance(pool.address, borrowToken.address, zeroAddress);
            const tokensLentAfter = await poolToken.totalSupply();
            const protocolFee = tokensLent.mul(testPoolFactoryParams._protocolFeeFraction).div(scaler);

            assert(tokensLent.toString() == tokensLentAfter.toString(), 'Tokens lent changing while withdrawing borrowed amount');
            assert(
                borrowAssetBalanceBorrower.add(tokensLent).sub(protocolFee).toString() == borrowAssetBalanceBorrowerAfter.toString(),
                `Borrower not receiving correct lent amount. Expected: ${borrowAssetBalanceBorrower
                    .add(tokensLent)
                    .toString()} Actual: ${borrowAssetBalanceBorrowerAfter.toString()}`
            );
            assert(
                borrowAssetBalancePool.toString() == borrowAssetBalancePoolAfter.add(tokensLentAfter).toString(),
                `Pool token balance is not changing correctly. Expected: ${borrowAssetBalancePoolAfter.toString()} Actual: ${borrowAssetBalancePool
                    .sub(tokensLentAfter)
                    .toString()}`
            );
            assert(
                borrowAssetBalancePoolSavings.toString() == borrowAssetBalancePoolSavingsAfter.toString(),
                `Savings account changing instead of token balance`
            );

            let LoanStatus = (await pool.poolVars()).loanStatus;
            assert(
                LoanStatus.toString() == BigNumber.from('1').toString(),
                `Pool is not in Active Stage. Expected: ${BigNumber.from('1').toString()} 
                Actual: ${LoanStatus}`
            );
        });
    });

    xdescribe('Pool Simulations: Defaulted Stage', async () => {
        let env: Environment;
        let pool: Pool;
        let poolAddress: Address;
        let poolToken: PoolToken;

        let deployHelper: DeployHelper;
        let BorrowAsset: ERC20;
        let CollateralAsset: ERC20;
        let iyield: IYield;

        const scaler = BigNumber.from('10').pow(30);

        before(async () => {
            env = await createEnvironment(
                hre,
                [WhaleAccount1, WhaleAccount2],
                [] as CompoundPair[],
                [
                    { asset: BorrowToken, liquidityToken: liquidityBorrowToken },
                    { asset: CollateralToken, liquidityToken: liquidityCollateralToken },
                ] as YearnPair[],
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
                    _poolInitFuncSelector: testPoolFactoryParams._poolInitFuncSelector,
                    _poolTokenInitFuncSelector: testPoolFactoryParams._poolTokenInitFuncSelector,
                    _liquidatorRewardFraction: testPoolFactoryParams._liquidatorRewardFraction,
                    _poolCancelPenalityFraction: testPoolFactoryParams._poolCancelPenalityFraction,
                    _protocolFeeFraction: testPoolFactoryParams._protocolFeeFraction,
                    protocolFeeCollector: '',
                    _minBorrowFraction: testPoolFactoryParams._minborrowFraction,
                } as PoolFactoryInitParams,
                CreditLineDefaultStrategy.Yearn,
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
            iyield = await deployHelper.mock.getYield(env.yields.yearnYield.address);

            let BTDecimals = await env.mockTokenContracts[0].contract.decimals();
            let CTDecimals = await env.mockTokenContracts[1].contract.decimals();

            poolAddress = await calculateNewPoolAddress(env, BorrowAsset, CollateralAsset, iyield, salt, false, {
                _poolSize: BigNumber.from(100).mul(BigNumber.from(10).pow(BTDecimals)),
                _volatilityThreshold: BigNumber.from(20).mul(BigNumber.from(10).pow(28)),
                _borrowRate: BigNumber.from(1).mul(BigNumber.from(10).pow(28)),
                _collateralAmount: BigNumber.from(Amount).mul(BigNumber.from(10).pow(CTDecimals)),
                _collateralRatio: BigNumber.from(250).mul(BigNumber.from(10).pow(28)),
                _collectionPeriod: 10000,
                _loanWithdrawalDuration: 200,
                _noOfRepaymentIntervals: 100,
                _repaymentInterval: 1000,
            });

            await env.mockTokenContracts[1].contract
                .connect(env.impersonatedAccounts[0])
                .transfer(admin.address, BigNumber.from(Amount).mul(BigNumber.from(10).pow(CTDecimals)));
            await env.mockTokenContracts[1].contract
                .connect(admin)
                .transfer(borrower.address, BigNumber.from(Amount).mul(BigNumber.from(10).pow(CTDecimals)));
            await env.mockTokenContracts[1].contract
                .connect(borrower)
                .approve(poolAddress, BigNumber.from(Amount).mul(BigNumber.from(10).pow(CTDecimals)));

            pool = await createNewPool(env, BorrowAsset, CollateralAsset, iyield, salt, false, {
                _poolSize: BigNumber.from(100).mul(BigNumber.from(10).pow(BTDecimals)),
                _minborrowAmount: BigNumber.from(10).mul(BigNumber.from(10).pow(BTDecimals)),
                _borrowRate: BigNumber.from(1).mul(BigNumber.from(10).pow(28)),
                _collateralAmount: BigNumber.from(Amount).mul(BigNumber.from(10).pow(CTDecimals)),
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
        });

        it('Anyone should be able to Liquidate the loan, if borrower misses repayment', async function () {
            let { admin, borrower, lender } = env.entities;
            let random = env.entities.extraLenders[10]; // Random address
            let BTDecimals = await env.mockTokenContracts[0].contract.decimals();
            let collateralToken = env.mockTokenContracts[1].contract;
            let borrowToken = env.mockTokenContracts[0].contract;
            let poolStrategy = env.yields.yearnYield;
            let amount = BigNumber.from(10).mul(BigNumber.from(10).pow(BTDecimals)); // 10 Borrow Tokens

            // Approving Borrow tokens to the lender
            await borrowToken.connect(env.impersonatedAccounts[1]).transfer(admin.address, amount);
            await borrowToken.connect(admin).transfer(lender.address, amount);
            await borrowToken.connect(lender).approve(poolAddress, amount);

            // Lender lends into the pool
            const lendExpect = expect(pool.connect(lender).lend(lender.address, amount, false));
            await lendExpect.to.emit(pool, 'LiquiditySupplied').withArgs(amount, lender.address);
            await lendExpect.to.emit(poolToken, 'Transfer').withArgs(zeroAddress, lender.address, amount);

            //block travel to escape withdraw interval
            const { loanStartTime } = await pool.poolConstants();
            await blockTravel(network, parseInt(loanStartTime.add(1).toString()));

            // Borrower withdraws borrow tokens
            await pool.connect(borrower).withdrawBorrowedAmount();

            // Borrower should default payment, either misses or margin calls happen
            const interestForCurrentPeriod = (
                await env.repayments.connect(borrower).getInterestDueTillInstalmentDeadline(pool.address)
            ).div(scaler);

            const repayAmount = createPoolParams._borrowRate
                .mul(amount)
                .mul(createPoolParams._repaymentInterval)
                .div(60 * 60 * 24 * 365)
                .div(scaler);

            // Checking calculated and received interest to be paid
            assert(
                interestForCurrentPeriod.toString() == repayAmount.toString(),
                `Incorrect interest for period. Actual: ${interestForCurrentPeriod.toString()} Expected: ${repayAmount.toString()}`
            );

            await borrowToken.connect(env.impersonatedAccounts[1]).transfer(admin.address, repayAmount);
            await borrowToken.connect(admin).transfer(random.address, repayAmount);
            await borrowToken.connect(random).approve(env.repayments.address, repayAmount);

            // Repayment done for period 1
            await env.repayments.connect(random).repayAmount(pool.address, repayAmount);

            const endOfPeriod: BigNumber = (await env.repayments.connect(borrower).getNextInstalmentDeadline(pool.address)).div(scaler);

            // Travel beyond the current repayment period, borrower misses next repayment
            await blockTravel(network, parseInt(endOfPeriod.add(1001).toString()));

            const collateralShares = await env.savingsAccount
                .connect(borrower)
                .userLockedBalance(pool.address, collateralToken.address, poolStrategy.address);
            let collateralTokens = await poolStrategy.callStatic.getTokensForShares(collateralShares.sub(2), collateralToken.address);
            let borrowTokensForCollateral = await pool.getEquivalentTokens(collateralToken.address, borrowToken.address, collateralTokens);

            // Calling liquidate pool
            await borrowToken.connect(env.impersonatedAccounts[1]).transfer(admin.address, borrowTokensForCollateral);
            await borrowToken.connect(admin).transfer(random.address, borrowTokensForCollateral);
            await borrowToken.connect(random).approve(pool.address, borrowTokensForCollateral);
            await pool.connect(random).liquidatePool(false, false, false);

            // Loan status should be 4
            let LoanStatus = (await pool.poolVars()).loanStatus;
            assert(
                LoanStatus.toString() == BigNumber.from('4').toString(),
                `Pool should be in Collection Stage. Expected: ${BigNumber.from('4').toString()}
                Actual: ${LoanStatus}`
            );
        });
    });

    xdescribe('Pool Simulations: Closed Stage', async () => {
        let env: Environment;
        let pool: Pool;
        let poolAddress: Address;
        let poolToken: PoolToken;

        let deployHelper: DeployHelper;
        let BorrowAsset: ERC20;
        let CollateralAsset: ERC20;
        let iyield: IYield;

        const scaler = BigNumber.from('10').pow(30);

        before(async () => {
            env = await createEnvironment(
                hre,
                [WhaleAccount1, WhaleAccount2],
                [] as CompoundPair[],
                [
                    { asset: BorrowToken, liquidityToken: liquidityBorrowToken },
                    { asset: CollateralToken, liquidityToken: liquidityCollateralToken },
                ] as YearnPair[],
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
                CreditLineDefaultStrategy.Yearn,
                { _protocolFeeFraction: testPoolFactoryParams._protocolFeeFraction } as CreditLineInitParams
            );

            let salt = sha256(Buffer.from(`borrower-${new Date().valueOf()}`));
            let { admin, borrower, lender } = env.entities;
            deployHelper = new DeployHelper(admin);
            BorrowAsset = await deployHelper.mock.getMockERC20(env.mockTokenContracts[0].contract.address);
            CollateralAsset = await deployHelper.mock.getMockERC20(env.mockTokenContracts[1].contract.address);
            iyield = await deployHelper.mock.getYield(env.yields.yearnYield.address);

            let BTDecimals = await env.mockTokenContracts[0].contract.decimals();
            let CTDecimals = await env.mockTokenContracts[1].contract.decimals();

            poolAddress = await calculateNewPoolAddress(env, BorrowAsset, CollateralAsset, iyield, salt, false, {
                _poolSize: BigNumber.from(100).mul(BigNumber.from(10).pow(BTDecimals)),
                _minborrowAmount: BigNumber.from(10).mul(BigNumber.from(10).pow(BTDecimals)),
                _borrowRate: BigNumber.from(1).mul(BigNumber.from(10).pow(28)),
                _collateralAmount: BigNumber.from(Amount).mul(BigNumber.from(10).pow(CTDecimals)),
                _collateralRatio: BigNumber.from(250).mul(BigNumber.from(10).pow(28)),
                _collectionPeriod: 10000,
                _matchCollateralRatioInterval: 200,
                _noOfRepaymentIntervals: 2, //100,
                _repaymentInterval: 1000,
            });

            // console.log({ calculatedPoolAddress: poolAddress });

            // console.log("Borrow Token: ", env.mockTokenContracts[0].name);
            // console.log("Collateral Token: ", env.mockTokenContracts[1].name);

            await env.mockTokenContracts[1].contract
                .connect(env.impersonatedAccounts[0])
                .transfer(admin.address, BigNumber.from(Amount).mul(BigNumber.from(10).pow(CTDecimals)));
            await env.mockTokenContracts[1].contract
                .connect(admin)
                .transfer(borrower.address, BigNumber.from(Amount).mul(BigNumber.from(10).pow(CTDecimals)));
            await env.mockTokenContracts[1].contract
                .connect(borrower)
                .approve(poolAddress, BigNumber.from(Amount).mul(BigNumber.from(10).pow(CTDecimals)));

            pool = await createNewPool(env, BorrowAsset, CollateralAsset, iyield, salt, false, {
                _poolSize: BigNumber.from(100).mul(BigNumber.from(10).pow(BTDecimals)),
                _minborrowAmount: BigNumber.from(10).mul(BigNumber.from(10).pow(BTDecimals)),
                _borrowRate: BigNumber.from(1).mul(BigNumber.from(10).pow(28)),
                _collateralAmount: BigNumber.from(Amount).mul(BigNumber.from(10).pow(CTDecimals)),
                _collateralRatio: BigNumber.from(250).mul(BigNumber.from(10).pow(28)),
                _collectionPeriod: 10000,
                _matchCollateralRatioInterval: 200,
                _noOfRepaymentIntervals: 2, //100,
                _repaymentInterval: 1000,
            });

            // console.log({ actualPoolAddress: pool.address });

            let poolTokenAddress = await pool.poolToken(); //Getting the address of the pool token

            poolToken = await deployHelper.pool.getPoolToken(poolTokenAddress);

            expect(await poolToken.name()).eq('Open Borrow Pool Tokens');
            expect(await poolToken.symbol()).eq('OBPT');
            expect(await poolToken.decimals()).eq(18);

            assert.equal(poolAddress, pool.address, 'Generated and Actual pool address should match');
        });

        it('Borrower should be able to close the pool, once repayment is done', async function () {
            let { admin, borrower, lender } = env.entities;
            let random = env.entities.extraLenders[10];
            let BTDecimals = await env.mockTokenContracts[0].contract.decimals();
            let collateralToken = env.mockTokenContracts[1].contract;
            let borrowToken = env.mockTokenContracts[0].contract;
            let poolStrategy = env.yields.yearnYield;
            let amount = BigNumber.from(10).mul(BigNumber.from(10).pow(BTDecimals)); // 10 Borrow Token

            // Approving Borrow tokens to the lender
            await borrowToken.connect(env.impersonatedAccounts[1]).transfer(admin.address, amount);
            await borrowToken.connect(admin).transfer(lender.address, amount);
            await borrowToken.connect(lender).approve(poolAddress, amount);

            // Lender lends into the pool
            const lendExpect = expect(pool.connect(lender).lend(lender.address, amount, false));
            await lendExpect.to.emit(pool, 'LiquiditySupplied').withArgs(amount, lender.address);
            await lendExpect.to.emit(poolToken, 'Transfer').withArgs(zeroAddress, lender.address, amount);

            //block travel to escape withdraw interval
            const { loanStartTime } = await pool.poolConstants();
            await blockTravel(network, parseInt(loanStartTime.add(1).toString()));

            // Borrower withdraws borrow tokens
            await pool.connect(borrower).withdrawBorrowedAmount();

            // Calculate repayment amount for period 1
            const interestForCurrentPeriod = (await env.repayments.connect(random).getInterestDueTillInstalmentDeadline(pool.address)).div(
                scaler
            );

            const repayAmount = createPoolParams._borrowRate
                .mul(amount)
                .mul(createPoolParams._repaymentInterval)
                .div(60 * 60 * 24 * 365)
                .div(scaler);

            assert(
                interestForCurrentPeriod.toString() == repayAmount.toString(),
                `Incorrect interest for period. Actual: ${interestForCurrentPeriod.toString()} Expected: ${repayAmount.toString()}`
            );

            await borrowToken.connect(env.impersonatedAccounts[1]).transfer(admin.address, repayAmount);
            await borrowToken.connect(admin).transfer(random.address, repayAmount);
            await borrowToken.connect(random).approve(env.repayments.address, repayAmount);

            // Repayment of Interest for period 1
            await env.repayments.connect(random).repayAmount(pool.address, repayAmount);
            console.log('Repayment for 1 period Done!');

            // Repayment of principal should be reverted as all repayments are not done
            await borrowToken.connect(env.impersonatedAccounts[1]).transfer(admin.address, amount);
            await borrowToken.connect(admin).transfer(random.address, amount);
            await borrowToken.connect(random).approve(env.repayments.address, amount);

            await expect(env.repayments.connect(random).repayPrincipal(pool.address, amount, { value: amount })).to.be.revertedWith(
                'Repayments:repayPrincipal Unpaid interest'
            );

            // Block travel to repayment period 2
            console.log('Timetravel to period 2');
            const endOfPeriod: BigNumber = (await env.repayments.connect(borrower).getNextInstalmentDeadline(pool.address)).div(scaler);
            await blockTravel(network, parseInt(endOfPeriod.add(10).toString()));

            let loanduration = (await env.repayments.connect(random).repaymentConstants(pool.address)).loanDuration;
            let loandurationDone = (await env.repayments.connect(random).repaymentVars(pool.address)).loanDurationCovered;

            console.log('loan duration', loanduration.toString());
            console.log('Loan duration done', loandurationDone.toString());

            // Calculate repayment amount for period 2
            const interestForCurrentPeriod1 = (await env.repayments.connect(random).getInterestDueTillInstalmentDeadline(pool.address)).div(
                scaler
            );
            console.log('Interest for second period observed', interestForCurrentPeriod1.toString());
            const repayAmount2 = createPoolParams._borrowRate
                .mul(amount)
                .mul(createPoolParams._repaymentInterval)
                .div(60 * 60 * 24 * 365)
                .div(scaler);

            await borrowToken.connect(env.impersonatedAccounts[1]).transfer(admin.address, repayAmount2);
            await borrowToken.connect(admin).transfer(random.address, repayAmount2);
            await borrowToken.connect(random).approve(env.repayments.address, repayAmount2);

            // Repayment of Interest for period 2
            await env.repayments.connect(random).repayAmount(pool.address, repayAmount2);
            console.log('Repayment for 2 period Done!');

            // Block travel to beyond repayment period 2
            console.log('Timetravel to beyond period 2');
            const endOfPeriod1: BigNumber = (await env.repayments.connect(borrower).getNextInstalmentDeadline(pool.address)).div(scaler);
            console.log('EndOfPeriod2', endOfPeriod1.toString());
            // const gracePeriod: BigNumber = repaymentParams.gracePeriodFraction.mul(createPoolParams._repaymentInterval).div(scaler);
            // await blockTravel(network, parseInt(endOfPeriod1.add(gracePeriod).add(10).toString()));
            await blockTravel(network, parseInt(endOfPeriod1.mul(2).toString()));

            loanduration = (await env.repayments.connect(random).repaymentConstants(pool.address)).loanDuration;
            loandurationDone = (await env.repayments.connect(random).repaymentVars(pool.address)).loanDurationCovered;

            console.log('Loan duration', loanduration.toString());
            console.log('Loan duration done', loandurationDone.toString());
            // Repayment of principal at the end of the loan
            await borrowToken.connect(env.impersonatedAccounts[1]).transfer(admin.address, amount);
            await borrowToken.connect(admin).transfer(random.address, amount);
            await borrowToken.connect(random).approve(env.repayments.address, amount);

            // Should it be random or borrower?
            await env.repayments.connect(random).repayPrincipal(pool.address, amount, { value: amount });

            // Loan status should be 2
            let LoanStatus = (await pool.poolVars()).loanStatus;
            console.log('Loan Status', LoanStatus);
            // assert(
            //     LoanStatus.toString() == BigNumber.from('2').toString(),
            //     `Pool should be in Collection Stage. Expected: ${BigNumber.from('2').toString()}
            //     Actual: ${LoanStatus}`
            // );
        });
    });

    describe('Pool Simulations: Cancellation Stage', async () => {
        let env: Environment;
        let pool: Pool;
        let poolAddress: Address;
        let poolToken: PoolToken;

        let deployHelper: DeployHelper;
        let BorrowAsset: ERC20;
        let CollateralAsset: ERC20;
        let iyield: IYield;

        before(async () => {
            env = await createEnvironment(
                hre,
                [WhaleAccount1, WhaleAccount2],
                [] as CompoundPair[],
                [
                    { asset: BorrowToken, liquidityToken: liquidityBorrowToken },
                    { asset: CollateralToken, liquidityToken: liquidityCollateralToken },
                ] as YearnPair[],
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
                CreditLineDefaultStrategy.Yearn,
                { _protocolFeeFraction: testPoolFactoryParams._protocolFeeFraction } as CreditLineInitParams
            );

            let salt = sha256(Buffer.from(`borrower-${new Date().valueOf()}`));
            let { admin, borrower, lender } = env.entities;
            deployHelper = new DeployHelper(admin);
            BorrowAsset = await deployHelper.mock.getMockERC20(env.mockTokenContracts[0].contract.address);
            CollateralAsset = await deployHelper.mock.getMockERC20(env.mockTokenContracts[1].contract.address);
            iyield = await deployHelper.mock.getYield(env.yields.yearnYield.address);

            let BTDecimals = await env.mockTokenContracts[0].contract.decimals();
            let CTDecimals = await env.mockTokenContracts[1].contract.decimals();

            poolAddress = await calculateNewPoolAddress(env, BorrowAsset, CollateralAsset, iyield, salt, false, {
                _poolSize: BigNumber.from(100).mul(BigNumber.from(10).pow(BTDecimals)),
                _minborrowAmount: BigNumber.from(10).mul(BigNumber.from(10).pow(BTDecimals)),
                _borrowRate: BigNumber.from(1).mul(BigNumber.from(10).pow(28)),
                _collateralAmount: BigNumber.from(Amount).mul(BigNumber.from(10).pow(CTDecimals)),
                _collateralRatio: BigNumber.from(250).mul(BigNumber.from(10).pow(28)),
                _collectionPeriod: 10000,
                _matchCollateralRatioInterval: 200,
                _noOfRepaymentIntervals: 100,
                _repaymentInterval: 1000,
            });

            // console.log({ calculatedPoolAddress: poolAddress });

            // console.log("Borrow Token: ", env.mockTokenContracts[0].name);
            // console.log("Collateral Token: ", env.mockTokenContracts[1].name);

            await env.mockTokenContracts[1].contract
                .connect(env.impersonatedAccounts[0])
                .transfer(admin.address, BigNumber.from(Amount).mul(BigNumber.from(10).pow(CTDecimals)));
            await env.mockTokenContracts[1].contract
                .connect(admin)
                .transfer(borrower.address, BigNumber.from(Amount).mul(BigNumber.from(10).pow(CTDecimals)));
            await env.mockTokenContracts[1].contract
                .connect(borrower)
                .approve(poolAddress, BigNumber.from(Amount).mul(BigNumber.from(10).pow(CTDecimals)));

            pool = await createNewPool(env, BorrowAsset, CollateralAsset, iyield, salt, false, {
                _poolSize: BigNumber.from(100).mul(BigNumber.from(10).pow(BTDecimals)),
                _minborrowAmount: BigNumber.from(10).mul(BigNumber.from(10).pow(BTDecimals)),
                _borrowRate: BigNumber.from(1).mul(BigNumber.from(10).pow(28)),
                _collateralAmount: BigNumber.from(Amount).mul(BigNumber.from(10).pow(CTDecimals)),
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
        });

        it('Borrower should be able to cancel the pool with penalty charges', async function () {
            let { admin, borrower, lender } = env.entities;
            let BTDecimals = await env.mockTokenContracts[0].contract.decimals();
            let Borrow = await env.mockTokenContracts[0].contract;

            const amount = BigNumber.from(10).mul(BigNumber.from(10).pow(BTDecimals));
            const poolTokenBalanceBefore = await poolToken.balanceOf(lender.address);
            const poolTokenTotalSupplyBefore = await poolToken.totalSupply();

            //Lenders lend borrow Tokens into the pool
            await env.mockTokenContracts[0].contract.connect(env.impersonatedAccounts[1]).transfer(admin.address, amount);
            await env.mockTokenContracts[0].contract.connect(admin).transfer(lender.address, amount);
            await env.mockTokenContracts[0].contract.connect(lender).approve(poolAddress, amount);

            const borrowTokenBalancebefore = await Borrow.balanceOf(lender.address);
            const borrowTokenBalancePool = await Borrow.balanceOf(pool.address);

            const lendExpect = expect(pool.connect(lender).lend(lender.address, amount, false));
            await lendExpect.to.emit(pool, 'LiquiditySupplied').withArgs(amount, lender.address);
            await lendExpect.to.emit(poolToken, 'Transfer').withArgs(zeroAddress, lender.address, amount);

            const poolTokenBalanceAfter = await poolToken.balanceOf(lender.address);
            const poolTokenTotalSupplyAfter = await poolToken.totalSupply();
            // const borrowTokenBalanceAfter = await Borrow.balanceOf(lender.address);
            assert(
                poolTokenBalanceAfter.toString() == poolTokenBalanceBefore.add(amount).toString(),
                `Pool tokens not minted correctly. amount: ${amount} Expected: ${poolTokenBalanceBefore.add(
                    amount
                )} Actual: ${poolTokenBalanceAfter}`
            );
            assert(
                poolTokenTotalSupplyAfter.toString() == poolTokenTotalSupplyBefore.add(amount).toString(),
                `Pool token supply not correct. amount: ${amount} Expected: ${poolTokenTotalSupplyBefore.add(
                    amount
                )} Actual: ${poolTokenTotalSupplyBefore}`
            );

            //borrower cancels the pool
            await pool.connect(borrower).cancelPool();

            // lender should be able to withdraw Liquidity
            await pool.connect(lender).withdrawLiquidity();

            // Checking balance after pool cancel and liquidation
            const poolTokenBalanceAfterCancel = await poolToken.balanceOf(lender.address);
            const poolTokenTotalSupplyAfterCancel = await poolToken.totalSupply();
            const borrowTokenBalanceAfterCancel = await Borrow.balanceOf(lender.address);

            assert(
                poolTokenBalanceAfterCancel.toString() == BigNumber.from('0').toString(),
                `Pool tokens not burnt correctly. amount: ${amount} Expected: ${BigNumber.from('0').toString()} 
                Actual: ${poolTokenBalanceAfterCancel}`
            );
            assert(
                poolTokenTotalSupplyAfterCancel.toString() == BigNumber.from('0').toString(),
                `Pool tokens not burnt correctly. amount: ${amount} Expected: ${BigNumber.from('0').toString()} 
                Actual: ${poolTokenTotalSupplyAfterCancel}`
            );
            assert(
                borrowTokenBalanceAfterCancel.toString() == borrowTokenBalancebefore.add(borrowTokenBalancePool).toString(),
                `Pool tokens not liquidated correctly and liquidation penalty not received. amount: ${amount} 
                Expected: ${borrowTokenBalancebefore.add(borrowTokenBalancePool).toString()} 
                Actual: ${borrowTokenBalanceAfterCancel}`
            );
            let LoanStatus = (await pool.poolVars()).loanStatus;
            assert(
                LoanStatus.toString() == BigNumber.from('3').toString(),
                `Pool not terminated correctly. Expected: ${BigNumber.from('3').toString()} 
                Actual: ${LoanStatus}`
            );
        });
    });

    describe('Pool Simulations: Termination Stage', async () => {
        let env: Environment;
        let pool: Pool;
        let poolAddress: Address;
        let poolToken: PoolToken;

        let deployHelper: DeployHelper;
        let BorrowAsset: ERC20;
        let CollateralAsset: ERC20;
        let iyield: IYield;

        before(async () => {
            env = await createEnvironment(
                hre,
                [WhaleAccount1, WhaleAccount2],
                [] as CompoundPair[],
                [
                    { asset: BorrowToken, liquidityToken: liquidityBorrowToken },
                    { asset: CollateralToken, liquidityToken: liquidityCollateralToken },
                ] as YearnPair[],
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
                CreditLineDefaultStrategy.Yearn,
                { _protocolFeeFraction: testPoolFactoryParams._protocolFeeFraction } as CreditLineInitParams
            );

            let salt = sha256(Buffer.from(`borrower-${new Date().valueOf()}`));
            let { admin, borrower, lender } = env.entities;
            deployHelper = new DeployHelper(admin);
            BorrowAsset = await deployHelper.mock.getMockERC20(env.mockTokenContracts[0].contract.address);
            CollateralAsset = await deployHelper.mock.getMockERC20(env.mockTokenContracts[1].contract.address);
            iyield = await deployHelper.mock.getYield(env.yields.yearnYield.address);

            let BTDecimals = await env.mockTokenContracts[0].contract.decimals();
            let CTDecimals = await env.mockTokenContracts[1].contract.decimals();

            poolAddress = await calculateNewPoolAddress(env, BorrowAsset, CollateralAsset, iyield, salt, false, {
                _poolSize: BigNumber.from(100).mul(BigNumber.from(10).pow(BTDecimals)),
                _minborrowAmount: BigNumber.from(10).mul(BigNumber.from(10).pow(BTDecimals)),
                _borrowRate: BigNumber.from(1).mul(BigNumber.from(10).pow(28)),
                _collateralAmount: BigNumber.from(Amount).mul(BigNumber.from(10).pow(CTDecimals)),
                _collateralRatio: BigNumber.from(250).mul(BigNumber.from(10).pow(28)),
                _collectionPeriod: 10000,
                _matchCollateralRatioInterval: 200,
                _noOfRepaymentIntervals: 100,
                _repaymentInterval: 1000,
            });

            // console.log({ calculatedPoolAddress: poolAddress });

            // console.log("Borrow Token: ", env.mockTokenContracts[0].name);
            // console.log("Collateral Token: ", env.mockTokenContracts[1].name);

            await env.mockTokenContracts[1].contract
                .connect(env.impersonatedAccounts[0])
                .transfer(admin.address, BigNumber.from(Amount).mul(BigNumber.from(10).pow(CTDecimals)));
            await env.mockTokenContracts[1].contract
                .connect(admin)
                .transfer(borrower.address, BigNumber.from(Amount).mul(BigNumber.from(10).pow(CTDecimals)));
            await env.mockTokenContracts[1].contract
                .connect(borrower)
                .approve(poolAddress, BigNumber.from(Amount).mul(BigNumber.from(10).pow(CTDecimals)));

            pool = await createNewPool(env, BorrowAsset, CollateralAsset, iyield, salt, false, {
                _poolSize: BigNumber.from(100).mul(BigNumber.from(10).pow(BTDecimals)),
                _volatilityThreshold: BigNumber.from(20).mul(BigNumber.from(10).pow(28)),
                _borrowRate: BigNumber.from(1).mul(BigNumber.from(10).pow(28)),
                _collateralAmount: BigNumber.from(Amount).mul(BigNumber.from(10).pow(CTDecimals)),
                _collateralRatio: BigNumber.from(250).mul(BigNumber.from(10).pow(28)),
                _collectionPeriod: 10000,
                _loanWithdrawalDuration: 200,
                _noOfRepaymentIntervals: 100,
                _repaymentInterval: 1000,
            });

            // console.log({ actualPoolAddress: pool.address });

            let poolTokenAddress = await pool.poolToken(); //Getting the address of the pool token

            poolToken = await deployHelper.pool.getPoolToken(poolTokenAddress);

            expect(await poolToken.name()).eq('Pool Tokens');
            expect(await poolToken.symbol()).eq('OBPT');
            expect(await poolToken.decimals()).eq(18);

            assert.equal(poolAddress, pool.address, 'Generated and Actual pool address should match');
        });

        it('Pool Factory owner should be able to terminate the pool', async function () {
            let { admin, borrower, lender } = env.entities;
            let BTDecimals = await env.mockTokenContracts[0].contract.decimals();

            const amount = BigNumber.from(10).mul(BigNumber.from(10).pow(BTDecimals));

            //Lenders can lend borrow Tokens into the pool
            await env.mockTokenContracts[0].contract.connect(env.impersonatedAccounts[1]).transfer(admin.address, amount);
            await env.mockTokenContracts[0].contract.connect(admin).transfer(lender.address, amount);
            await env.mockTokenContracts[0].contract.connect(lender).approve(poolAddress, amount);

            const lendExpect = expect(pool.connect(lender).lend(lender.address, amount, false));
            await lendExpect.to.emit(pool, 'LiquiditySupplied').withArgs(amount, lender.address);
            await lendExpect.to.emit(poolToken, 'Transfer').withArgs(zeroAddress, lender.address, amount);

            await expect(pool.connect(admin).terminatePool()).to.emit(pool, 'PoolTerminated');

            // Check if loan status is set to 'TERMINATED' (5)
            let LoanStatus = (await pool.poolVariables()).loanStatus;
            assert(
                LoanStatus.toString() == BigNumber.from('5').toString(),
                `Pool not terminated correctly. Expected: ${BigNumber.from('5').toString()} 
                Actual: ${LoanStatus}`
            );
        });
    });
}
