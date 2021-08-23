import { createEnvironment, calculateNewPoolAddress, createNewPool } from "../createEnv";
import { getContractAddress } from '@ethersproject/address';

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

import {
    ChainLinkAggregators,
    extensionParams,
    repaymentParams,
    testPoolFactoryParams,
    aaveYieldParams,
    createPoolParams,
    zeroAddress
} from '../constants-rahul';

import hre from 'hardhat';
const {ethers, network} = hre
import { Contracts } from '../../existingContracts/compound.json';
import { assert, expect } from "chai";

import DeployHelper from "../deploys";
import { ERC20 } from "@typechain/ERC20";
import { sha256 } from '@ethersproject/sha2';
import { PoolToken } from '../../typechain/PoolToken';
import { BigNumber, BigNumberish } from 'ethers';
import { IYield } from '@typechain/IYield';
import { Context } from 'mocha';
import { Address } from 'hardhat-deploy/dist/types';
import { Pool } from '@typechain/Pool';
import { create } from "underscore";
import { OperationalAmounts } from "@utils/constants";
import { getProxyAdminFactory } from "@openzeppelin/hardhat-upgrades/dist/utils";

export async function poolLendingTest(
    amount: Number,
    Whale1: Address,
    Whale2: Address,
    BorrowTokenParam: Address,
    CollateralTokenParam: Address,
    liquidityBorrowTokenParam: Address,
    liquidityCollateralTokenParam: Address,
    chainlinkBorrowParam: Address,
    chainlinkCollateralParam: Address
): Promise<any> {
    describe("Pool", async() => {
        let env:Environment;
        let deployHelper: DeployHelper;
        let borrowToken: ERC20;
        let collateralToken: ERC20;
        let iYield: IYield;
        let generatedPoolAddress: Address;
        let pool: Pool;
        let poolToken: PoolToken;
        before(async () => {
            env = await createEnvironment(
                hre,
                [Whale1, Whale2],
                [
                    { asset: BorrowTokenParam, liquidityToken: liquidityBorrowTokenParam},
                    { asset: CollateralTokenParam, liquidityToken: liquidityCollateralTokenParam },
                ] as CompoundPair[],
                [] as YearnPair[],
                [
                    { tokenAddress: BorrowTokenParam, feedAggregator: chainlinkBorrowParam },
                    { tokenAddress: CollateralTokenParam, feedAggregator: chainlinkCollateralParam },
                ] as PriceOracleSource[],                {
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
            
            
            console.log("createEnvironment() executed successfully.");

            let {admin, borrower, lender} = env.entities;
            deployHelper = new DeployHelper(admin);
            borrowToken = await deployHelper.mock.getMockERC20(env.mockTokenContracts[0].contract.address); //DAI
            collateralToken = await deployHelper.mock.getMockERC20(env.mockTokenContracts[1].contract.address); //LINK 
            iYield = await deployHelper.mock.getYield(env.yields.compoundYield.address);
            
            let salt = sha256(Buffer.from(`borrower-${new Date().valueOf()}`));        
            let BorrowDecimals: BigNumber = await env.mockTokenContracts[0].contract.decimals();
            let CollateralDecimals:BigNumber = await env.mockTokenContracts[1].contract.decimals();    

            console.log("Params for calculateNewPoolAddress generated.")

            // await env.poolFactory
            //     .connect(admin)
            //     .updateVolatilityThreshold(env.mockTokenContracts[0].contract.address, testPoolFactoryParams._collateralVolatilityThreshold);
            // await env.poolFactory
            //     .connect(admin)
            //     .updateVolatilityThreshold(env.mockTokenContracts[1].contract.address, testPoolFactoryParams._collateralVolatilityThreshold);
            
            console.log("Volatility Threshold updated.")    

            generatedPoolAddress = await calculateNewPoolAddress(
                env,
                borrowToken,
                collateralToken,
                iYield,
                salt,
                false,
                {
                    _poolSize: BigNumber.from(100).mul(BigNumber.from(10).pow(BorrowDecimals)), // max possible borrow tokens in DAI pool ~1000 DAI
                    _minborrowAmount: BigNumber.from(10).mul(BigNumber.from(10).pow(BorrowDecimals)), //10 DAI,
                    _borrowRate: BigNumber.from(1).mul(BigNumber.from(10).pow(28)), // 100 * 10^28 in contract means 100% to outside,,
                    _collateralAmount: BigNumber.from(amount).mul(BigNumber.from(10).pow(CollateralDecimals)),
                    _collateralRatio: BigNumber.from(250).mul(BigNumber.from(10).pow(28)),
                    _collectionPeriod:10000,
                    _matchCollateralRatioInterval: 200,
                    _noOfRepaymentIntervals: 100,
                    _repaymentInterval: 1000,
                }
            );
           
            console.log("Borrow Token: ", env.mockTokenContracts[0].name);
            console.log("Collateral Token: ", env.mockTokenContracts[1].name);
            console.log("Generated Pool address is: ", generatedPoolAddress);
            console.log("calculateNewPoolAddress() is executed successfully.")
            
            // const nonce = (await env.poolFactory.provider.getTransactionCount(env.poolFactory.address)) + 1;
            // let newPoolToken: string = getContractAddress({
            //     from: env.poolFactory.address,
            //     nonce,
            // });

            //console.log("getContractAddress() is executed successfully.")

            let collateralAmount = BigNumber.from(amount).mul(BigNumber.from(10).pow(CollateralDecimals));
            console.log(await collateralToken.balanceOf(admin.address));
            console.log(collateralAmount);
            console.log(await collateralToken.balanceOf(borrower.address));
            await env.mockTokenContracts[1].contract.connect(env.impersonatedAccounts[0]).transfer(admin.address, collateralAmount.mul(2));
            await env.mockTokenContracts[1].contract.connect(admin).transfer(borrower.address, collateralAmount);
            await env.mockTokenContracts[1].contract.connect(borrower).approve(generatedPoolAddress, collateralAmount);
            console.log(await collateralToken.balanceOf(borrower.address));

            console.log("collateralToken transfers took place.");

            console.log(BorrowDecimals, CollateralDecimals);

            pool = await createNewPool(
                env,
                borrowToken,
                collateralToken,
                iYield,
                salt,
                false,
                {
                    _poolSize: BigNumber.from(100).mul(BigNumber.from(10).pow(BorrowDecimals)), // max possible borrow tokens in DAI pool ~1000 DAI
                    _minborrowAmount: BigNumber.from(10).mul(BigNumber.from(10).pow(BorrowDecimals)), //10 DAI,
                    _borrowRate: BigNumber.from(1).mul(BigNumber.from(10).pow(28)), // 100 * 10^28 in contract means 100% to outside,,
                    _collateralAmount: BigNumber.from(amount).mul(BigNumber.from(10).pow(CollateralDecimals)),
                    _collateralRatio: BigNumber.from(250).mul(BigNumber.from(10).pow(28)),
                    _collectionPeriod:10000,
                    _matchCollateralRatioInterval: 200,
                    _noOfRepaymentIntervals: 100,
                    _repaymentInterval: 1000,
                }
            );

            // await expect(
            //     env.poolFactory
            //         .connect(borrower)
            //         .createPool(
            //             BigNumber.from(1000).mul(BigNumber.from(10).pow(18)), // max possible borrow tokens in DAI pool ~1000 DAI
            //             BigNumber.from(10).mul(BigNumber.from(10).pow(18)), //10 DAI,
            //             borrowToken.address,
            //             collateralToken.address,
            //             BigNumber.from(250).mul(BigNumber.from(10).pow(28)),
            //             BigNumber.from(1).mul(BigNumber.from(10).pow(28)), // 100 * 10^28 in contract means 100% to outside,,
            //             BigNumber.from(1000),
            //             BigNumber.from(10),
            //             env.yields.compoundYield.address,
            //             BigNumber.from(1).mul(BigNumber.from(10).pow(18)),
            //             false,  
            //             salt
            //         )
            // )
            // .to.emit(env.poolFactory, 'PoolCreated')
            // .withArgs(generatedPoolAddress, borrower.address, newPoolToken);
            // console.log("Borrower pool created.")

            // let deployHelper: DeployHelper = new DeployHelper(borrower);
            let poolTokenAddress = await pool.poolToken();
            poolToken = await deployHelper.pool.getPoolToken(poolTokenAddress);

            expect(await poolToken.name()).eq('Open Borrow Pool Tokens');
            expect(await poolToken.symbol()).eq('OBPT');
            expect(await poolToken.decimals()).eq(18);

            assert.equal(generatedPoolAddress, pool.address, "Generated and Actual pool address are the same");
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
            await env.savingsAccount.connect(lender1).depositTo(amount, env.mockTokenContracts[0].contract.address, zeroAddress, lender1.address);
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

}