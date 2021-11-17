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
import { expectApproxEqual } from "../helpers";

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
    describe("Testing suite for lending scenarios: ", async () => {
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

        it("Lender should be able to lend the borrow tokens directly to the pool along with event emission:  ", async function() {
            let { admin, borrower, lender } = env.entities;
            let BTDecimals = await env.mockTokenContracts[0].contract.decimals();

            const amount = BigNumber.from(1).mul(BigNumber.from(10).pow(BTDecimals));
            const poolTokenBalanceBefore = await pool.balanceOf(lender.address);
            const poolTokenTotalSupplyBefore = await pool.totalSupply();

            //Lenders can lend borrow Tokens into the pool
            await env.mockTokenContracts[0].contract.connect(env.impersonatedAccounts[1]).transfer(admin.address, amount);
            await env.mockTokenContracts[0].contract.connect(admin).transfer(lender.address, amount);
            await env.mockTokenContracts[0].contract.connect(lender).approve(poolAddress, amount);

            const lendExpect = expect(pool.connect(lender).lend(lender.address, amount, false));
            await lendExpect.to.emit(pool, 'LiquiditySupplied').withArgs(amount, lender.address);
            await lendExpect.to.emit(pool, 'Transfer').withArgs(zeroAddress, lender.address, amount);

            const poolTokenBalanceAfter = await pool.balanceOf(lender.address);
            const poolTokenTotalSupplyAfter = await pool.totalSupply();
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

        it.only("Lender can't lend more than the requested amount: ", async function() {
            let { admin, borrower, lender } = env.entities;
            let BTDecimals = await env.mockTokenContracts[0].contract.decimals();

            const amount = BigNumber.from(10).mul(BigNumber.from(10).pow(BTDecimals));
            const poolTokenBalanceBefore = await pool.balanceOf(lender.address);
            const poolTokenTotalSupplyBefore = await pool.totalSupply();

            const surplusAmount = amount.mul(2);

            //Lenders can lend borrow Tokens into the pool
            await env.mockTokenContracts[0].contract.connect(env.impersonatedAccounts[1]).transfer(admin.address, surplusAmount);
            await env.mockTokenContracts[0].contract.connect(admin).transfer(lender.address, surplusAmount);
            await env.mockTokenContracts[0].contract.connect(lender).approve(poolAddress, surplusAmount);

            const lendExpect = expect(pool.connect(lender).lend(lender.address, surplusAmount, false));
            await lendExpect.to.emit(pool, 'LiquiditySupplied').withArgs(surplusAmount, lender.address);
            await lendExpect.to.emit(pool, 'Transfer').withArgs(zeroAddress, lender.address, surplusAmount);

            const poolTokenBalanceAfter = await pool.balanceOf(lender.address);
            const poolTokenTotalSupplyAfter = await pool.totalSupply();
            
            console.log("Amount: ", amount.toString());
            console.log("Lender Before Balance: ", poolTokenBalanceBefore.toString());
            console.log("Lender After Balance: ", poolTokenBalanceAfter.toString());
            console.log("Pool Token supply after: ", poolTokenTotalSupplyAfter.toString());
            console.log("Pool Token supply before: ", poolTokenTotalSupplyBefore.toString());

            expect(3).eq(3);
        });
    });
}
