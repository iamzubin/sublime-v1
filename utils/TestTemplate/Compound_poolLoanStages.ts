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

import { extensionParams, repaymentParams, testPoolFactoryParams, creditLineFactoryParams, createPoolParams, zeroAddress } from '../constants-Additions';

import DeployHelper from '../deploys';
import { ERC20 } from '../../typechain/ERC20';
import { sha256 } from '@ethersproject/sha2';
import { BigNumber } from 'ethers';
import { IYield } from '@typechain/IYield';
import { Address } from 'hardhat-deploy/dist/types';
import { Pool } from '@typechain/Pool';
import { PoolToken } from '@typechain/PoolToken';
import { CompoundYield } from '@typechain/CompoundYield';
import { expectApproxEqual } from '../helpers';
import { incrementChain, timeTravel, blockTravel } from '../../utils/time';

export async function compoundPoolCollectionStage(
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
                {
                    _protocolFeeFraction: creditLineFactoryParams._protocolFeeFraction,
                    _liquidatorRewardFraction: creditLineFactoryParams._liquidatorRewardFraction
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
        });

        it('Borrower should be able to directly add more Collateral to the pool', async function () {
            let { admin, borrower, lender } = env.entities;
            let CTDecimals = await env.mockTokenContracts[1].contract.decimals();
            let Collateral = await env.mockTokenContracts[1].contract.address;
            let depositAmount = BigNumber.from(1).mul(BigNumber.from(10).pow(CTDecimals));

            // Transfering again as the initial amount was used for initial deposit
            await env.mockTokenContracts[1].contract.connect(env.impersonatedAccounts[0]).transfer(admin.address, depositAmount);
            await env.mockTokenContracts[1].contract.connect(admin).transfer(borrower.address, depositAmount);
            await env.mockTokenContracts[1].contract.connect(borrower).approve(poolAddress, depositAmount);

            // Checking balance before deposit
            let SharesBefore = (await pool.poolVars()).baseLiquidityShares;

            // Direct Collateral deposit
            await pool.connect(borrower).depositCollateral(depositAmount, false);

            // Checking balance after deposit
            let SharesAfter = (await pool.poolVars()).baseLiquidityShares;

            // Getting additional Shares
            let SharesReceived = SharesAfter.sub(SharesBefore);
            // console.log({SharesReceived: SharesReceived.toNumber()});

            // Checking shares received and matching with the deposited amount
            let liquidityShares = await env.yields.compoundYield.callStatic.getSharesForTokens(depositAmount, Collateral);
            // console.log({ LiquidityShares: liquidityShares.toNumber() });
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

            let liquidityShares = await env.yields.compoundYield.callStatic.getTokensForShares(AmountForDeposit, Collateral.address);
            // console.log({ LiquidityShares: liquidityShares.toString() });
            // console.log({ DepositAmount: AmountForDeposit.toString() });

            // Transfering again as the initial amount was used for initial deposit
            await Collateral.connect(env.impersonatedAccounts[0]).transfer(admin.address, depositAmount);
            await Collateral.connect(admin).transfer(borrower.address, depositAmount);
            await Collateral.connect(borrower).approve(env.yields.compoundYield.address, liquidityShares.mul(100));

            // Approving the Savings Account for deposit of tokens
            await env.savingsAccount.connect(borrower).approve(Collateral.address, pool.address, liquidityShares.mul(100));
            await env.savingsAccount
                .connect(borrower)
                .deposit(liquidityShares.mul(100), Collateral.address, env.yields.compoundYield.address, borrower.address);

            // Checking balance before deposit
            let SharesBefore = (await pool.poolVars()).baseLiquidityShares;

            // Depositing Tokens
            await expect(pool.connect(borrower).depositCollateral(AmountForDeposit, true)).to.emit(env.savingsAccount, 'Transfer');

            // Checking balance after deposit
            let SharesAfter = (await pool.poolVars()).baseLiquidityShares;

            // Getting additional Shares
            let SharesReceived = SharesAfter.sub(SharesBefore);

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
            await env.savingsAccount.connect(lender).approve(env.mockTokenContracts[0].contract.address, pool.address, amount);

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
            await env.savingsAccount.connect(lender1).approve(env.mockTokenContracts[0].contract.address, pool.address, amount);

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

    describe('Pool Simulations: Active Stage', async () => {
        let env: Environment;
        let pool: Pool;
        let poolAddress: Address;
        let poolToken: PoolToken;

        let deployHelper: DeployHelper;
        let BorrowAsset: ERC20;
        let CollateralAsset: ERC20;
        let iyield: IYield;
        let Compound: CompoundYield;

        const scaler = BigNumber.from('10').pow(30);

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
                {
                    _protocolFeeFraction: creditLineFactoryParams._protocolFeeFraction,
                    _liquidatorRewardFraction: creditLineFactoryParams._liquidatorRewardFraction
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
                _minborrowAmount: BigNumber.from(10).mul(BigNumber.from(10).pow(BTDecimals)),
                _borrowRate: BigNumber.from(1).mul(BigNumber.from(10).pow(28)),
                _collateralAmount: BigNumber.from(Amount).mul(BigNumber.from(10).pow(CTDecimals)),
                _collateralRatio: BigNumber.from(250).mul(BigNumber.from(10).pow(28)),
                _collectionPeriod: 10000,
                _matchCollateralRatioInterval: 200,
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

            const tokensLent = await poolToken.totalSupply();
            await pool.connect(borrower).withdrawBorrowedAmount();
            const borrowAssetBalanceBorrowerAfter = await borrowToken.balanceOf(borrower.address);
            const borrowAssetBalancePoolAfter = await borrowToken.balanceOf(pool.address);

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

            let LoanStatus = (await pool.poolVars()).loanStatus;
            assert(
                LoanStatus.toString() == BigNumber.from('1').toString(),
                `Pool is not in Active Stage. Expected: ${BigNumber.from('1').toString()} 
            Actual: ${LoanStatus}`
            );
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
                {
                    _protocolFeeFraction: creditLineFactoryParams._protocolFeeFraction,
                    _liquidatorRewardFraction: creditLineFactoryParams._liquidatorRewardFraction
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
                _minborrowAmount: BigNumber.from(10).mul(BigNumber.from(10).pow(BTDecimals)),
                _borrowRate: BigNumber.from(1).mul(BigNumber.from(10).pow(28)),
                _collateralAmount: BigNumber.from(Amount).mul(BigNumber.from(10).pow(CTDecimals)),
                _collateralRatio: BigNumber.from(250).mul(BigNumber.from(10).pow(28)),
                _collectionPeriod: 10000,
                _matchCollateralRatioInterval: 200,
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
                {
                    _protocolFeeFraction: creditLineFactoryParams._protocolFeeFraction,
                    _liquidatorRewardFraction: creditLineFactoryParams._liquidatorRewardFraction
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
                _minborrowAmount: BigNumber.from(10).mul(BigNumber.from(10).pow(BTDecimals)),
                _borrowRate: BigNumber.from(1).mul(BigNumber.from(10).pow(28)),
                _collateralAmount: BigNumber.from(Amount).mul(BigNumber.from(10).pow(CTDecimals)),
                _collateralRatio: BigNumber.from(250).mul(BigNumber.from(10).pow(28)),
                _collectionPeriod: 10000,
                _matchCollateralRatioInterval: 200,
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

            let poolTokenAddress = await pool.poolToken(); //Getting the address of the pool token

            poolToken = await deployHelper.pool.getPoolToken(poolTokenAddress);

            expect(await poolToken.name()).eq('Open Borrow Pool Tokens');
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

            await expect(pool.connect(admin).terminateOpenBorrowPool()).to.emit(pool, 'OpenBorrowPoolTerminated');

            // Check if loan status is set to 'TERMINATED' (5)
            let LoanStatus = (await pool.poolVars()).loanStatus;
            assert(
                LoanStatus.toString() == BigNumber.from('5').toString(),
                `Pool not terminated correctly. Expected: ${BigNumber.from('5').toString()} 
            Actual: ${LoanStatus}`
            );
        });
    });
}
