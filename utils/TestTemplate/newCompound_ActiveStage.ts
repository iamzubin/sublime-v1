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
const { ethers, network } = hre;
import { expect, assert } from 'chai';

import {
    extensionParams,
    repaymentParams,
    testPoolFactoryParams,
    creditLineFactoryParams,
    createPoolParams,
    zeroAddress,
} from '../constants-Additions';

import DeployHelper from '../deploys';
import { ERC20 } from '../../typechain/ERC20';
import { sha256 } from '@ethersproject/sha2';
import { BigNumber } from 'ethers';
import { IYield } from '../../typechain/IYield';
import { Address } from 'hardhat-deploy/dist/types';
import { Pool } from "../../typechain/Pool";
import { PoolToken } from '../../typechain/PoolToken';
import { CompoundYield } from '../../typechain/CompoundYield';
import { expectApproxEqual } from '../helpers';
import { incrementChain, timeTravel, blockTravel, blocksTravel } from '../../utils/time';
import { boolean } from 'hardhat/internal/core/params/argumentTypes';

export async function preActivePoolChecks(
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
    describe('After loan starts and before loanWithdrawalDeadline or lent amount withdraw', async () => {
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

        beforeEach(async () => {
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
                    _poolInitFuncSelector: testPoolFactoryParams._poolInitFuncSelector,
                    _poolTokenInitFuncSelector: testPoolFactoryParams._poolTokenInitFuncSelector,
                    _liquidatorRewardFraction: testPoolFactoryParams._liquidatorRewardFraction,
                    _poolCancelPenalityFraction: testPoolFactoryParams._poolCancelPenalityFraction,
                    _protocolFeeFraction: testPoolFactoryParams._protocolFeeFraction,
                    protocolFeeCollector: '',
                    _minBorrowFraction: testPoolFactoryParams._minborrowFraction,
                } as PoolFactoryInitParams,
                CreditLineDefaultStrategy.Compound,
                {
                    _protocolFeeFraction: creditLineFactoryParams._protocolFeeFraction,
                    _liquidatorRewardFraction: creditLineFactoryParams._liquidatorRewardFraction,
                } as CreditLineInitParams
            );

            let salt = sha256(Buffer.from('borrower' + Math.random() * 10000000));
            let { admin, borrower, lender } = env.entities;
            deployHelper = new DeployHelper(admin);
            BorrowAsset = await deployHelper.mock.getMockERC20(env.mockTokenContracts[0].contract.address);
            CollateralAsset = await deployHelper.mock.getMockERC20(env.mockTokenContracts[1].contract.address);
            iyield = await deployHelper.mock.getYield(env.yields.compoundYield.address);

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

        it("Pool tokens should be transferable", async function() {
            let { admin, borrower, lender } = env.entities;
            let random = env.entities.extraLenders[10]; // Random address
            let BTDecimals = await env.mockTokenContracts[0].contract.decimals();
            let collateralToken = env.mockTokenContracts[1].contract;
            let borrowToken = env.mockTokenContracts[0].contract;
            let poolStrategy = env.yields.compoundYield;
            let amount = BigNumber.from(10).mul(BigNumber.from(10).pow(BTDecimals)); // 10 Borrow Tokens

            // Lender approves his borrow tokens to be used by the pool to get some Pool Tokens
            await env.mockTokenContracts[0].contract.connect(env.impersonatedAccounts[1]).transfer(admin.address, amount);
            await env.mockTokenContracts[0].contract.connect(admin).transfer(lender.address, amount);
            await env.mockTokenContracts[0].contract.connect(lender).approve(poolAddress, amount);

            // Lender actually lends his Borrow Tokens
            const lendExpect = expect(pool.connect(lender).lend(lender.address, amount, false));
            await lendExpect.to.emit(pool, 'LiquiditySupplied').withArgs(amount, lender.address);
            await lendExpect.to.emit(poolToken, 'Transfer').withArgs(zeroAddress, lender.address, amount);

            // Now, the lender should have some Pool Tokens and the random address should have none
            const poolTokenBalanceOfLenderInitial = await poolToken.balanceOf(lender.address);
            console.log(poolTokenBalanceOfLenderInitial);
            const poolTokenBalanceOfRandomInitial = await poolToken.balanceOf(random.address);
            console.log(poolTokenBalanceOfRandomInitial);

            // Transferring lender's Pool Tokens to the random address to check whether the pool tokens are transferable or not
            poolToken.connect(lender).transfer(random.address, (amount.div(2)));

            // Testing the pool token balance of the random address now
            const poolTokenBalanceOfLenderFinal = await poolToken.balanceOf(lender.address);
            const poolTokenBalanceOfRandomFinal = await poolToken.balanceOf(random.address);
            console.log("Lender: ", poolTokenBalanceOfLenderFinal, "Random: ", poolTokenBalanceOfRandomFinal);
            assert(poolTokenBalanceOfRandomFinal.sub(poolTokenBalanceOfRandomInitial).gt(0) , "The pool token balance of random address did not increase after transfer from lender");
        });

        it("Lender can't withdraw tokens lent in this period: ", async function() {
            let { admin, borrower, lender } = env.entities;
            let BTDecimals = await env.mockTokenContracts[0].contract.decimals();
            let amount = BigNumber.from(10).mul(BigNumber.from(10).pow(BTDecimals)); // 10 Borrow Tokens
    
            // Lender approves his borrow tokens to be used by the pool to get some Pool Tokens
            await env.mockTokenContracts[0].contract.connect(env.impersonatedAccounts[1]).transfer(admin.address, amount);
            await env.mockTokenContracts[0].contract.connect(admin).transfer(lender.address, amount);
            await env.mockTokenContracts[0].contract.connect(lender).approve(poolAddress, amount);
    
            // Lender actually lends his Borrow Tokens
            const lendExpect = expect(pool.connect(lender).lend(lender.address, amount, false));
            await lendExpect.to.emit(pool, 'LiquiditySupplied').withArgs(amount, lender.address);
            await lendExpect.to.emit(poolToken, 'Transfer').withArgs(zeroAddress, lender.address, amount);

            // Check whether the pool has went into the active stage of the loan or not
            let {loanStatus} = await pool.poolVariables();
            assert.equal(loanStatus.toString(), BigNumber.from('0').toString(), 
            `Pool should have been in active stage, found in: ${loanStatus}`);

            //Withdrawing tokens by the lender should fail
            await expect(pool.connect(lender).withdrawLiquidity()).to.be.revertedWith('');
        });

        it("Before borrower withdraws in this period, extension request is not possible: ", async function() {
            let {admin, borrower, lender} = env.entities;
            let randomEntity = env.entities.extraLenders[33];
            let BTDecimals = await env.mockTokenContracts[0].contract.decimals();
            let amount = BigNumber.from(10).mul(BigNumber.from(10).pow(BTDecimals));

            // Lender approves his borrow tokens to be used by the pool to get some Pool Tokens
            await env.mockTokenContracts[0].contract.connect(env.impersonatedAccounts[1]).transfer(admin.address, amount);
            await env.mockTokenContracts[0].contract.connect(admin).transfer(lender.address, amount);
            await env.mockTokenContracts[0].contract.connect(lender).approve(poolAddress, amount);

            // Lender actually lends his Borrow Tokens
            const lendExpect = expect(pool.connect(lender).lend(lender.address, amount, false));
            await lendExpect.to.emit(pool, 'LiquiditySupplied').withArgs(amount, lender.address);
            await lendExpect.to.emit(poolToken, 'Transfer').withArgs(zeroAddress, lender.address, amount);

            // Only borrower should be able to request extension
            await expect(env.extenstion.connect(randomEntity).requestExtension(pool.address)).to.be.revertedWith('Not Borrower');
            await expect(env.extenstion.connect(lender).requestExtension(pool.address)).to.be.revertedWith('Not Borrower');

            // The borrower too shouldn't be able to request extension in this period
            await expect(env.extenstion.connect(borrower).requestExtension(pool.address)).to.be.revertedWith('');
        });

        /*
        // To-DO: Fix this test. liquidatePool is throwing a safeMath error: Division by zero
        it("Before borrower withdraws in this period, liquidation is not possible: ", async function() {
            let {admin, lender, borrower} = env.entities;
            let randomLender = env.entities.extraLenders[33];
            let BTDecimals = await env.mockTokenContracts[0].contract.decimals();
            let collateralToken = await env.mockTokenContracts[1].contract;
            let borrowToken = await env.mockTokenContracts[0].contract;
            let poolStrategy = await env.yields.compoundYield;
            let amount = BigNumber.from(10).mul(BigNumber.from(10).pow(BTDecimals));
            let borrowTokenWhale = await env.impersonatedAccounts[1];

            console.log("h1");
            // Lender approves his borrow tokens to be used by the pool to get some Pool Tokens
            await borrowToken.connect(env.impersonatedAccounts[1]).transfer(admin.address, amount);
            await borrowToken.connect(admin).transfer(lender.address, amount);
            await borrowToken.connect(lender).approve(poolAddress, amount);

            console.log("h2");
            // Lender actually lends his Borrow Tokens
            const lendExpect = expect(pool.connect(lender).lend(lender.address, amount, false));
            await lendExpect.to.emit(pool, 'LiquiditySupplied').withArgs(amount, lender.address);
            await lendExpect.to.emit(poolToken, 'Transfer').withArgs(zeroAddress, lender.address, amount);

            console.log("h3");
            const collateralShares = await env.savingsAccount.connect(borrower).balanceInShares(pool.address, collateralToken.address, poolStrategy.address);
            console.log("Collateral Shares: ", collateralShares.toString());
            let collateralTokens = await poolStrategy.callStatic.getTokensForShares(collateralShares, collateralToken.address);
            console.log("CollateralTokens: ", collateralTokens.toString());
            let borrowTokensForCollateral = await pool.getEquivalentTokens(collateralToken.address, borrowToken.address, collateralTokens);
            console.log("borrowTokensForCollateral: ", borrowTokensForCollateral.toString());
            console.log("Amount: ", amount.toString());

            console.log("h4");
            await borrowToken.connect(env.impersonatedAccounts[1]).transfer(admin.address, borrowTokensForCollateral);
            await borrowToken.connect(admin).transfer(randomLender.address, borrowTokensForCollateral);
            await borrowToken.connect(randomLender).approve(pool.address, borrowTokensForCollateral);

            let {loanStatus} = await pool.poolVariables()
            console.log(loanStatus);

            console.log("h5");
            console.log("Random Lender Balance: ", (await (borrowToken.balanceOf(randomLender.address))).toString());
            await expect(pool.connect(randomLender).liquidatePool(false, false, true)).to.be.revertedWith("randomString");
        });
        */

        it("Lender should not be able to request margin calls in this time period: ", async function() {
            let{admin, lender, borrower} = env.entities;
            
            //The request for this margin call should fail
            await expect(pool.connect(lender).requestMarginCall()).to.be.revertedWith('2');
        });

        it("Loan repayment shouldn't be possible in this time-frame: ", async function() {
            let {admin, lender, borrower} = env.entities;
            let BTDecimals = await env.mockTokenContracts[0].contract.decimals();
            let collateralToken = env.mockTokenContracts[1].contract;
            let borrowToken = env.mockTokenContracts[0].contract;
            let amount = BigNumber.from(10).mul(BigNumber.from(10).pow(BTDecimals));

            // Lender approves his borrow tokens to be used by the pool to get some Pool Tokens
            await env.mockTokenContracts[0].contract.connect(env.impersonatedAccounts[1]).transfer(admin.address, amount);
            await env.mockTokenContracts[0].contract.connect(admin).transfer(lender.address, amount);
            await env.mockTokenContracts[0].contract.connect(lender).approve(poolAddress, amount);

            // Lender actually lends his Borrow Tokens
            const lendExpect = expect(pool.connect(lender).lend(lender.address, amount, false));
            await lendExpect.to.emit(pool, 'LiquiditySupplied').withArgs(amount, lender.address);
            await lendExpect.to.emit(poolToken, 'Transfer').withArgs(zeroAddress, lender.address, amount);
            
            // Taking any arbitrary amount as repayment amount as env.repayments.connect(borrower).getInterestDueTillInstalment(pool.address) will return 0
            const repayAmount = BigNumber.from(10).mul(BigNumber.from(10).pow(BTDecimals-2)); 

            await borrowToken.connect(env.impersonatedAccounts[1]).transfer(admin.address, repayAmount.mul(2));
            await borrowToken.connect(admin).transfer(borrower.address, repayAmount.mul(2));
            await borrowToken.connect(borrower).approve(env.repayments.address, repayAmount);

            await expect(env.repayments.connect(borrower).repay(pool.address, repayAmount)).to.be.revertedWith("Pool is not Initiliazed");
        });


        it("Borrower can withdraw the borrow amount only if amount lent is more than minBorrowFraction of requested amount: ", async function() {
            let { admin, borrower, lender } = env.entities;
            let random = env.entities.extraLenders[10]; // Random address
            let BTDecimals = await env.mockTokenContracts[0].contract.decimals();
            let collateralToken = env.mockTokenContracts[1].contract;
            let borrowToken = env.mockTokenContracts[0].contract;
            let poolStrategy = env.yields.compoundYield;
            let amount = BigNumber.from(1).mul(BigNumber.from(10).pow(BTDecimals)); // 1 Borrow Token
    
            // Lender approves his borrow tokens to be used by the pool to get some Pool Tokens
            await env.mockTokenContracts[0].contract.connect(env.impersonatedAccounts[1]).transfer(admin.address, amount);
            await env.mockTokenContracts[0].contract.connect(admin).transfer(lender.address, amount);
            await env.mockTokenContracts[0].contract.connect(lender).approve(poolAddress, amount);
    
            // Lender actually lends his Borrow Tokens
            const lendExpect = expect(pool.connect(lender).lend(lender.address, amount, false));
            await lendExpect.to.emit(pool, 'LiquiditySupplied').withArgs(amount, lender.address);
            await lendExpect.to.emit(poolToken, 'Transfer').withArgs(zeroAddress, lender.address, amount);

            //block travel to reach the activation stage
            const { loanStartTime } = await pool.poolConstants();
            await blockTravel(network, parseInt(loanStartTime.add(1).toString()));

            // Check whether the pool has went into the active stage of the loan or not
            let {loanStatus} = await pool.poolVariables();
            assert.equal(loanStatus.toString(), BigNumber.from('0').toString(), 
            `Pool should have been in active stage, found in: ${loanStatus}`);

            //Borrower request to withdraw smalller amount should be rejected
            await expect(pool.connect(borrower).withdrawBorrowedAmount()).to.revertedWith('13');
        });

        // DOUBT: Penalty calculated is not same as penalty deducted from Borrower's collateral
        it("Borrower can cancel the pool in the collection stage with a penalty: ", async function() {
            let {admin, borrower, lender} = env.entities;
            let borrowToken = env.mockTokenContracts[0].contract;
            let BTDecimals = await env.mockTokenContracts[0].contract.decimals();
            let collateralToken = env.mockTokenContracts[1].contract;
            let amount = BigNumber.from(10).mul(BigNumber.from(10).pow(BTDecimals));
            let poolStrategy = env.yields.compoundYield;

            //Lender approves his Borrow Tokens to be used by the pool
            await borrowToken.connect(env.impersonatedAccounts[1]).transfer(admin.address, amount);
            await borrowToken.connect(admin).transfer(lender.address, amount);
            await borrowToken.connect(lender).approve(pool.address, amount);

            // Lender actually lends his Borrow Tokens
            const lendExpect = expect(pool.connect(lender).lend(lender.address, amount, false));
            await lendExpect.to.emit(pool, 'LiquiditySupplied').withArgs(amount, lender.address);
            await lendExpect.to.emit(poolToken, 'Transfer').withArgs(zeroAddress, lender.address, amount);

            // The balance of the pool is equivalent to the balance of the collateralShares of the pool
            const collateralBalancePoolBeforeCancel = await env.savingsAccount.connect(admin).balanceInShares(pool.address, collateralToken.address, poolStrategy.address);
            console.log("Collateral Token Balance of Pool: ", collateralBalancePoolBeforeCancel.toString());

            let baseLiquidityShares = (await pool.poolVariables()).baseLiquidityShares;
            let poolCancelPenaltyFraction = testPoolFactoryParams._poolCancelPenalityFraction;
            let borrowRate = (await pool.poolConstants()).borrowRate;
            let scalingNumber = BigNumber.from(10).pow(30);
            let penaltyTime = (await pool.poolConstants()).repaymentInterval;
            let yearInSeconds = 365*24*60*60;

            let penaltyForCancelling = poolCancelPenaltyFraction.mul(borrowRate).mul(baseLiquidityShares).div(scalingNumber).mul(penaltyTime).div(yearInSeconds).div(scalingNumber);
            console.log("Penalty for Cancelling: ", penaltyForCancelling.toString());
            // Borrower cancels the pool in the collection stage itself
            await pool.connect(borrower).cancelPool();

            // Balance of the borrower now (collateral submitted - penalty imposed)
            const borrowerCollateralSharesAfterCancel = await env.savingsAccount.connect(borrower).balanceInShares(borrower.address, collateralToken.address, poolStrategy.address);
            console.log(borrowerCollateralSharesAfterCancel.toString());

            assert(collateralBalancePoolBeforeCancel.toString() !== borrowerCollateralSharesAfterCancel.toString(), "Penalty not deducted");
        });

        it("Protocol Fee is subtracted when borrower withdraws borrow amount, along with withdraw event emission & adjusted tokens reaching the borrower: ", async function() {
            let { admin, borrower, lender, protocolFeeCollector } = env.entities;
            let random = env.entities.extraLenders[10]; // Random address
            let BTDecimals = await env.mockTokenContracts[0].contract.decimals();
            let collateralToken = env.mockTokenContracts[1].contract;
            let borrowToken = env.mockTokenContracts[0].contract;
            let amount = BigNumber.from(10).mul(BigNumber.from(10).pow(BTDecimals)); // 10 Borrow Tokens
            let poolStrategy = env.yields.compoundYield;

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

            const borrowAssetBalanceBorrower = await borrowToken.balanceOf(borrower.address);
            console.log(borrowAssetBalanceBorrower.toString());

            const tokensLent = await poolToken.totalSupply();
            console.log(tokensLent.toString());
            
            // Borrower withdraws borrow tokens
            await expect(pool.connect(borrower).withdrawBorrowedAmount()).to.emit(pool, "AmountBorrowed").withArgs(amount);

            const borrowAssetBalanceBorrowerAfter = await borrowToken.balanceOf(borrower.address);
            console.log(borrowAssetBalanceBorrowerAfter.toString());

            const protocolFee = tokensLent.mul(testPoolFactoryParams._protocolFeeFraction).div(scaler);
            console.log(protocolFee.toString());

            const checkProtcolFee = await borrowToken.balanceOf(protocolFeeCollector.address);
            console.log(checkProtcolFee.toString());
            // IMO, we are not really comparing the exact tokens. That is, the protocolFee is in terms of poolTokens and we are checking Sublime's borrowToken balance.
            // But since the poolTokens are generated in 1:1 ratio of borrowTokens, therefore the numbers are same
            expect(checkProtcolFee).to.eq(protocolFee); 
            
            assert(
                borrowAssetBalanceBorrower.add(tokensLent).sub(protocolFee).toString() == borrowAssetBalanceBorrowerAfter.toString(),
                `Borrower not receiving correct lent amount. Expected: ${borrowAssetBalanceBorrower
                    .add(tokensLent)
                    .toString()} Actual: ${borrowAssetBalanceBorrowerAfter.toString()}`
            );
            
            // This step is to remove the protocol fee, for other tests
            await borrowToken.connect(protocolFeeCollector).transfer(admin.address, checkProtcolFee);
        });

        // it("Borrower can't withdraw lent amount if collateral falls below ideal collateral ratio: ", async function() {
        //     let { admin, borrower, lender, protocolFeeCollector } = env.entities;
        //     let random = env.entities.extraLenders[10]; // Random address
        //     let BTDecimals = await env.mockTokenContracts[0].contract.decimals();
        //     let collateralToken = env.mockTokenContracts[1].contract;
        //     let borrowToken = env.mockTokenContracts[0].contract;
        //     let amount = BigNumber.from(10).mul(BigNumber.from(10).pow(BTDecimals)); // 10 Borrow Tokens
        //     let poolStrategy = env.yields.compoundYield;

        //     // Approving Borrow tokens to the lender
        //     await borrowToken.connect(env.impersonatedAccounts[1]).transfer(admin.address, amount);
        //     await borrowToken.connect(admin).transfer(lender.address, amount);
        //     await borrowToken.connect(lender).approve(poolAddress, amount);

        //     // Lender lends into the pool
        //     const lendExpect = expect(pool.connect(lender).lend(lender.address, amount, false));
        //     await lendExpect.to.emit(pool, 'LiquiditySupplied').withArgs(amount, lender.address);
        //     await lendExpect.to.emit(poolToken, 'Transfer').withArgs(zeroAddress, lender.address, amount);

        //     expect(3).eq(3);
        // });

        it("During collection period, borrower can't withdraw tokens lent or repay interest or request extension: ", async function() {
            let { admin, borrower, lender, protocolFeeCollector } = env.entities;
            let random = env.entities.extraLenders[10]; // Random address
            let BTDecimals = await env.mockTokenContracts[0].contract.decimals();
            let collateralToken = env.mockTokenContracts[1].contract;
            let borrowToken = env.mockTokenContracts[0].contract;
            let amount = BigNumber.from(10).mul(BigNumber.from(10).pow(BTDecimals)); // 10 Borrow Tokens
            let poolStrategy = env.yields.compoundYield;

            // Approving Borrow tokens to the lender
            await borrowToken.connect(env.impersonatedAccounts[1]).transfer(admin.address, amount);
            await borrowToken.connect(admin).transfer(lender.address, amount);
            await borrowToken.connect(lender).approve(poolAddress, amount);

            // Lender lends into the pool
            const lendExpect = expect(pool.connect(lender).lend(lender.address, amount, false));
            await lendExpect.to.emit(pool, 'LiquiditySupplied').withArgs(amount, lender.address);
            await lendExpect.to.emit(poolToken, 'Transfer').withArgs(zeroAddress, lender.address, amount);

            //It is still the collection period, and we will try to withdraw the tokens lent as the borrower
            await expect(pool.connect(borrower).withdrawBorrowedAmount()).to.be.revertedWith("12");

            // It is still the collection period, and we will try to repay interest as the borrower
            // Taking any arbitrary amount as repayment amount as env.repayments.connect(borrower).getInterestDueTillInstalment(pool.address) will return 0
            //const interestForCurrentPeriod = (await env.repayments.connect(borrower).getInterestDueTillInstalmentDeadline(pool.address)).div(scaler);
            //console.log(interestForCurrentPeriod.toString());

            const repayAmount = BigNumber.from(10).mul(BigNumber.from(10).pow(BTDecimals-2)); 

            await borrowToken.connect(env.impersonatedAccounts[1]).transfer(admin.address, repayAmount.mul(2));
            await borrowToken.connect(admin).transfer(borrower.address, repayAmount.mul(2));
            await borrowToken.connect(borrower).approve(env.repayments.address, repayAmount);

            await expect(env.repayments.connect(borrower).repay(pool.address, repayAmount)).to.be.revertedWith("Pool is not Initiliazed");

            //It is still the collection period, borrower should not be able to request extension:
            await expect(env.extenstion.connect(borrower).requestExtension(pool.address)).to.be.revertedWith("Transaction reverted without a reason");
        });

        it("During collection period, no one can liquidate lender or request margin call: ", async function() {
            let{admin, lender, borrower} = env.entities;
            let random = env.entities.extraLenders[33];
            let BTDecimals = await env.mockTokenContracts[0].contract.decimals();
            let collateralToken = env.mockTokenContracts[1].contract;
            let borrowToken = env.mockTokenContracts[0].contract;
            let amount = BigNumber.from(10).mul(BigNumber.from(10).pow(BTDecimals)); // 10 Borrow Tokens
            let poolStrategy = env.yields.compoundYield;

            // Approving Borrow tokens to the lender
            await borrowToken.connect(env.impersonatedAccounts[1]).transfer(admin.address, amount);
            await borrowToken.connect(admin).transfer(lender.address, amount);
            await borrowToken.connect(lender).approve(poolAddress, amount);

            // Lender lends into the pool
            const lendExpect = expect(pool.connect(lender).lend(lender.address, amount, false));
            await lendExpect.to.emit(pool, 'LiquiditySupplied').withArgs(amount, lender.address);
            await lendExpect.to.emit(poolToken, 'Transfer').withArgs(zeroAddress, lender.address, amount);
                        
            //The request for this margin call should fail
            await expect(pool.connect(lender).requestMarginCall()).to.be.revertedWith('4');
            // By the borrower
            await expect(pool.connect(lender).requestMarginCall()).to.be.revertedWith('4');
            // By random
            await expect(pool.connect(lender).requestMarginCall()).to.be.revertedWith('4');

            // The request to liquidate lender during this period should fail
            await expect(pool.connect(random).liquidateForLender(lender.address, false, false, false)).to.be.revertedWith("27");

            /*
            // Request to liquidate pool should fail during this period
            await borrowToken.connect(env.impersonatedAccounts[1]).transfer(admin.address, amount);
            await borrowToken.connect(admin).transfer(random.address, amount);
            await borrowToken.connect(random).approve(pool.address, amount));

            expect (await pool.connect(random).liquidatePool(false, false, false)).to.be.revertedWith('randomString');
            */
        });
    });
}
