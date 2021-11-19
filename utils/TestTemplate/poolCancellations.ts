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
    creditLineFactoryParams,
    createPoolParams,
    zeroAddress,
    ChainLinkAggregators,
} from '../constants';

import DeployHelper from '../deploys';
import { ERC20 } from '../../typechain/ERC20';
import { sha256 } from '@ethersproject/sha2';
import { BigNumber } from 'ethers';
import { IYield } from '@typechain/IYield';
import { Address } from 'hardhat-deploy/dist/types';
import { Pool } from '@typechain/Pool';
import { CompoundYield } from '@typechain/CompoundYield';
import { expectApproxEqual } from '../helpers';
import { incrementChain, timeTravel, blockTravel } from '../time';
import { getPoolInitSigHash } from '../createEnv/poolLogic';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';

export async function cancellationChecks(
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
    describe('Testing suite for various pool cancellation scenarios: ', async () => {
        let env: Environment;
        let pool: Pool;
        let poolAddress: Address;

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

            assert.equal(poolAddress, pool.address, 'Generated and Actual pool address should match');
        });

        it("Pool cannot be cancelled by anyone if lent amount is withdrawn by borrower", async function() {
            let { admin, borrower, lender } = env.entities;
            let random = env.entities.extraLenders[10]; // Random address
            let poolStrategy = env.yields.compoundYield;
            let BTDecimals = await env.mockTokenContracts[0].contract.decimals();
            let CTDecimals = await env.mockTokenContracts[1].contract.decimals();
            let collateralToken = env.mockTokenContracts[1].contract;
            let borrowToken = env.mockTokenContracts[0].contract;
            let amount = BigNumber.from(10).mul(BigNumber.from(10).pow(BTDecimals)); // 10 Borrow Tokens

            // Lender approves his borrow tokens to be used by the pool to get some Pool Tokens
            await env.mockTokenContracts[0].contract.connect(env.impersonatedAccounts[1]).transfer(admin.address, amount);
            await env.mockTokenContracts[0].contract.connect(admin).transfer(lender.address, amount);
            await env.mockTokenContracts[0].contract.connect(lender).approve(poolAddress, amount);

            // Lender actually lends his Borrow Tokens
            const lendExpect = expect(pool.connect(lender).lend(lender.address, amount, false));
            await lendExpect.to.emit(pool, 'LiquiditySupplied').withArgs(amount, lender.address);
            await lendExpect.to.emit(pool, 'Transfer').withArgs(zeroAddress, lender.address, amount);

            //block travel to reach the activation stage
            const { loanStartTime } = await pool.poolConstants();
            await blockTravel(network, parseInt(loanStartTime.add(1).toString()));

            // Check whether the pool has went into the active stage of the loan or not
            let {loanStatus} = await pool.poolVariables();
            assert.equal(loanStatus.toString(), BigNumber.from('0').toString(), 
            `Pool should have been in active stage, found in: ${loanStatus}`);

            //Borrower borrows the amount
            await expect(pool.connect(borrower).withdrawBorrowedAmount()).to.emit(pool, "AmountBorrowed").withArgs(amount);

            // Nobody should be able to cancel the pool after the loan has been taken including the borrower, lender and random
            await expect(pool.connect(borrower).cancelPool()).to.be.revertedWith("CP1");
            await expect(pool.connect(lender).cancelPool()).to.be.revertedWith("CP1");
            await expect(pool.connect(random).cancelPool()).to.be.revertedWith("CP1");
        });

        it("Pool can be cancelled by anyone after the loanWithdrawalDeadline; corrected collateral is withdrawn to the borrower; pool tokens become non-transferable", async function() {
            let { admin, borrower, lender } = env.entities;
            let random = env.entities.extraLenders[10];
            let poolStrategy = env.yields.compoundYield;
            let BTDecimals = await env.mockTokenContracts[0].contract.decimals();
            let CTDecimals = await env.mockTokenContracts[1].contract.decimals();
            let collateralToken = env.mockTokenContracts[1].contract;
            let borrowToken = env.mockTokenContracts[0].contract;
            let amount = BigNumber.from(100).mul(BigNumber.from(10).pow(BTDecimals)); // 10 Borrow Tokens
            let strategy = env.yields.compoundYield.address;

            // Lender approves his borrow tokens to be used by the pool to get some Pool Tokens
            await env.mockTokenContracts[0].contract.connect(env.impersonatedAccounts[1]).transfer(admin.address, amount);
            await env.mockTokenContracts[0].contract.connect(admin).transfer(lender.address, amount);
            await env.mockTokenContracts[0].contract.connect(lender).approve(poolAddress, amount);

            // Lender actually lends his Borrow Tokens
            const lendExpect = expect(pool.connect(lender).lend(lender.address, amount, false));
            await lendExpect.to.emit(pool, 'LiquiditySupplied').withArgs(amount, lender.address);
            await lendExpect.to.emit(pool, 'Transfer').withArgs(zeroAddress, lender.address, amount);

            //Try to travel past the loanwithdrawal deadline:
            const {loanWithdrawalDeadline} = await pool.poolConstants();
            await blockTravel(network, parseInt(loanWithdrawalDeadline.add(1).toString()));

            // The balance of the pool is equivalent to the balance of the collateralShares of the pool
            // Before balances:
            const collateralBalanceOfPoolInShares = await env.savingsAccount.connect(admin)
                                                                            .balanceInShares(pool.address, collateralToken.address, poolStrategy.address);
            const collateralBalanceOfPoolInTokens = await env.yields
                                                                .compoundYield
                                                                .callStatic
                                                                .getTokensForShares(collateralBalanceOfPoolInShares, collateralToken.address);
            console.log("Collateral Balance Of Pool In Tokens: ", collateralBalanceOfPoolInTokens.toString());
            const collateralBalanceOfBorrowerInShares = await env.savingsAccount.connect(admin)
                                                                                .balanceInShares(borrower.address, collateralToken.address, poolStrategy.address);
            const collateralBalanceOfBorrowerInTokens = await env.yields.compoundYield.callStatic
                                                                                .getTokensForShares(collateralBalanceOfBorrowerInShares, collateralToken.address);

            /*
            console.log("Collateral Balance of Pool before Cancellation: ", collateralBalanceOfPoolInTokens.toString());
            console.log("Collateral Balance of Borrower before Cancellation: ", collateralBalanceOfBorrowerInTokens.toString());
            console.log("Non saving account balance of Borrower: ", preCancelBorrower.toString());
            */

            //Penalty Calculation
            let baseLiquidityShares = (await pool.poolVariables()).baseLiquidityShares;
            const {loanStartTime} = await pool.poolConstants();
            let penaltyTime = ((await pool.poolConstants()).repaymentInterval).add(loanWithdrawalDeadline.sub(loanStartTime));
            let penaltyMultiple = testPoolFactoryParams._poolCancelPenalityFraction;
            let borrowRate = (await pool.poolConstants()).borrowRate;
            let yearInSeconds = 365*24*60*60;
            const precisionNumber = BigNumber.from(10).pow(30);

            let penaltyAmount = penaltyMultiple
                                    .mul(borrowRate)
                                    .mul(baseLiquidityShares)
                                    .div(precisionNumber)
                                    .mul(penaltyTime)
                                    .div(yearInSeconds)
                                    .div(precisionNumber);
            
            console.log(penaltyAmount.toString());
            // A random entity tries to cancel the pool
            await expect(pool.connect(random).cancelPool()).to.emit(pool, "PoolCancelled");

            // The withdrawLiquidity function should be only callable by the lender
            await expect(pool.connect(random).withdrawLiquidity()).to.be.revertedWith('IL1');
            await expect(pool.connect(borrower).withdrawLiquidity()).to.be.revertedWith('IL1');
            await expect(pool.connect(lender).withdrawLiquidity()).to.emit(pool, "LiquidityWithdrawn");

            //Checking whether the pool has been cancelled or not
            let {loanStatus} = await pool.poolVariables();
            //console.log("Loan Status: ", loanStatus);

            // Pool tokens should not be transferable after a pool is closed:
            const poolTokenBalanceOfLenderInitial = await pool.balanceOf(lender.address);
            const poolTokenBalanceOfRandomInitial = await pool.balanceOf(random.address);

            // Transferring lender's Pool Tokens to the random address to check whether the pool tokens are transferable or not
            await expect(pool.connect(lender).transfer(random.address, (amount.div(2)))).to.be.revertedWith('TT1');

            // Testing the pool token balance of the random address now
            const poolTokenBalanceOfLenderFinal = await pool.balanceOf(lender.address);
            const poolTokenBalanceOfRandomFinal = await pool.balanceOf(random.address);
            assert(poolTokenBalanceOfRandomFinal.sub(poolTokenBalanceOfRandomInitial).eq(0) , "The pool token balance of random address should not have increased."); 
            assert(poolTokenBalanceOfLenderInitial.sub(poolTokenBalanceOfLenderFinal).eq(0), "The lender's balance of pool tokens should not change");
            
            // Collateral should be auto-withdrawn to the borrower, after removing the penalty
            //After balances:
            const collateralBalanceOfPoolInSharesNext = await env.savingsAccount.connect(admin).balanceInShares(pool.address, collateralToken.address, strategy);
            const collateralBalanceOfPoolInTokensNext = await env.yields.compoundYield.callStatic.getTokensForShares(collateralBalanceOfPoolInShares, collateralToken.address);

            const collateralBalanceOfBorrowerInSharesNext = await env.savingsAccount.connect(admin).balanceInShares(borrower.address, collateralToken.address, poolStrategy.address);
            const collateralBalanceOfBorrowerInTokensNext = await env.yields.compoundYield.callStatic.getTokensForShares(collateralBalanceOfBorrowerInShares, collateralToken.address);
            
            /*
            This test to determine the auto-withdrawal of collateral minus penalty back to the borrower works when using shares. 
            Fails when using tokens. See for yourselves using the console.log statments
            
            console.log("Collateral Balance of Pool after Cancellation: ", collateralBalanceOfPoolInTokensNext.toString());
            console.log("Collateral Balance of Borrower after Cancellation: ", collateralBalanceOfBorrowerInTokensNext.toString());
            console.log("Non saving account balance of Borrower: ", postCancelBorrower.toString());

            console.log("Before Pool: ", collateralBalanceOfPoolInShares.toString());
            console.log("After Pool: ", collateralBalanceOfPoolInSharesNext.toString());
            console.log("Before Borrower: ", collateralBalanceOfBorrowerInShares.toString());
            console.log("After Borrower: ", collateralBalanceOfBorrowerInSharesNext.toString());
            */

            let collateralBalanceOfBorrowerInSharesAfterCancel = await env.yields.compoundYield.callStatic.getTokensForShares(collateralBalanceOfBorrowerInSharesNext, collateralToken.address);
            console.log(collateralBalanceOfBorrowerInSharesAfterCancel.toString());

            let penaltyAmountInTokens = await env.yields.compoundYield.callStatic.getTokensForShares(penaltyAmount, CollateralAsset.address);
            console.log(penaltyAmountInTokens.toString());

            assert((collateralBalanceOfBorrowerInSharesNext.add(collateralBalanceOfPoolInSharesNext)).eq(collateralBalanceOfPoolInShares), "Collateral incorrectly withdrawn");
            expectApproxEqual(collateralBalanceOfPoolInTokens.sub(collateralBalanceOfBorrowerInSharesAfterCancel) , penaltyAmountInTokens, 100, "The deducted amount and penalty varied too much");
        });

        it("Pool cannot be cancelled when extensions have been granted: ", async function() {
            let BTDecimals = await env.mockTokenContracts[0].contract.decimals();
            let CTDecimals = await env.mockTokenContracts[1].contract.decimals();
            let {admin, borrower, lender} = env.entities;
            let random = env.entities.extraLenders[33];

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

            let {loanStatus} = await pool.poolVariables();
            console.log(loanStatus);

            await pool.connect(borrower).withdrawBorrowedAmount();

            let Ext_Variables = await env.extenstion.connect(admin).extensions(pool.address);
            let VoteEndTime = Ext_Variables.extensionVoteEndTime;
            console.log(VoteEndTime.toString());

            // Requesting the extension
            await env.extenstion.connect(borrower).requestExtension(pool.address);

            let Ext_Variables1 = await env.extenstion.connect(admin).extensions(pool.address);
            let VoteEndTime1 = Ext_Variables1.extensionVoteEndTime;
            console.log(VoteEndTime1.toString());

            // Extension passes only when majority lenders vote in favour
            /*
                Wierd Bug: In the below lines, the lender1 votes first and then the lender and the test goes on as expected.
                However, if I put the lender first and then the lender1 in terms of voting, then the test reverts with: `Voting Complete`  revert message
            */
            
            await env.extenstion.connect(lender1).voteOnExtension(pool.address);
            await env.extenstion.connect(lender).voteOnExtension(pool.address);
            const {isLoanExtensionActive} = await env.repayments.connect(admin).repayVariables(pool.address);
            
            console.log("isLoanExtensionActive: ",isLoanExtensionActive);
            assert(isLoanExtensionActive, 'Extension not active');

            // Cancelling the pool
            await expect(pool.connect(random).cancelPool()).to.be.revertedWith('CP1');
        });
    });
}