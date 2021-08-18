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
    createPoolParams
} from '../constants-rahul';

import hre from 'hardhat';
import { Contracts } from '../../existingContracts/compound.json';
import { expect } from "chai";

import DeployHelper from "../deploys";
import { ERC20 } from "@typechain/ERC20";
import { sha256 } from '@ethersproject/sha2';
import { PoolToken } from '../../typechain/PoolToken';
import { BigNumber } from 'ethers';
import { IYield } from '@typechain/IYield';
import { Context } from 'mocha';
import { Address } from 'hardhat-deploy/dist/types';
import { Pool } from '@typechain/Pool';
import { create } from "underscore";

export async function poolCreationTest(
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
            
            await env.mockTokenContracts[0].contract.connect(env.impersonatedAccounts[0]).transfer(env.entities.admin.address, BigNumber.from('10').pow(23)); // 50,000 DAI  tokens    
            await env.mockTokenContracts[1].contract.connect(env.impersonatedAccounts[1]).transfer(env.entities.admin.address, BigNumber.from('10').pow(23)); // 50,000 LINK tokens
        
        });    
        it('create pools', async() => {
            console.log("createEnvironment() executed successfully.")
            let {admin, borrower, lender} = env.entities;

            // await env.poolFactory
            //     .connect(admin)
            //     .updateVolatilityThreshold(env.mockTokenContracts[0].contract.address, testPoolFactoryParams._collateralVolatilityThreshold);
            // await env.poolFactory
            //     .connect(admin)
            //     .updateVolatilityThreshold(env.mockTokenContracts[1].contract.address, testPoolFactoryParams._collateralVolatilityThreshold);
            
            console.log("Volatility Threshold updated.")

            let borrowToken: ERC20 = env.mockTokenContracts[0].contract //DAI
            let collateralToken: ERC20 = env.mockTokenContracts[1].contract; //LINK 
            let salt = sha256(Buffer.from(`borrower-${new Date().valueOf()}`));

            console.log("Params for calculateNewPoolAddress generated.")

            let generatedPoolAddress: Address = await calculateNewPoolAddress(
                env,
                borrowToken,
                collateralToken,
                env.yields.compoundYield,
                salt,
                false,
                {
                    _poolSize: BigNumber.from(1000).mul(BigNumber.from(10).pow(18)), // max possible borrow tokens in DAI pool;
                    _minborrowAmount: BigNumber.from(10).mul(BigNumber.from(10).pow(18)), // 10 DAI;
                    _borrowRate: BigNumber.from(5).mul(BigNumber.from(10).pow(28)),
                    _collateralAmount: BigNumber.from(1).mul(BigNumber.from(10).pow(18)), //1 LINK
                    _collateralRatio: BigNumber.from(60).mul(BigNumber.from(10).pow(28)),
                    _collectionPeriod: BigNumber.from(5000000),
                    _matchCollateralRatioInterval: 200,
                    _noOfRepaymentIntervals: BigNumber.from(25),
                    _repaymentInterval:  BigNumber.from(1000)
                }
            );
            
            console.log("calculateNewPoolAddress() is executed successfully.")
            
            const nonce = (await env.poolFactory.provider.getTransactionCount(env.poolFactory.address)) + 1;
            let newPoolToken: string = getContractAddress({
                from: env.poolFactory.address,
                nonce,
            });
            console.log("getContractAddress() is executed successfully.")

            let _collateralAmount = BigNumber.from(1).mul(BigNumber.from(10).pow(18));

            console.log(await collateralToken.balanceOf(admin.address));
            console.log(_collateralAmount);
            console.log(await collateralToken.balanceOf(borrower.address));
            await collateralToken.connect(admin).transfer(borrower.address, _collateralAmount.mul(2));
            await collateralToken.approve(generatedPoolAddress, _collateralAmount.mul(2));
            console.log(await collateralToken.balanceOf(borrower.address));

            console.log("collateralToken transfers took place.");

            await expect(
                env.poolFactory
                    .connect(borrower)
                    .createPool(
                        BigNumber.from(1000).mul(BigNumber.from(10).pow(18)), // max possible borrow tokens in DAI pool
                        BigNumber.from(10).mul(BigNumber.from(10).pow(18)), // 10 DAI
                        env.mockTokenContracts[0].contract.address,
                        env.mockTokenContracts[1].contract.address,
                        BigNumber.from(200).mul(BigNumber.from(10).pow(28)),
                        BigNumber.from(5).mul(BigNumber.from(10).pow(28)), // 100 * 10^28 in contract means 100% to outside,
                        BigNumber.from(1000),
                        BigNumber.from(25),
                        env.yields.compoundYield.address,
                        BigNumber.from(1).mul(BigNumber.from(10).pow(18)), //1 LINK
                        false,
                        sha256(Buffer.from('borrower'))
                    )
            )
            .to.emit(env.poolFactory, 'PoolCreated')
            .withArgs(generatedPoolAddress, borrower.address, newPoolToken);
            console.log("Borrower pool created.")

            let deployHelper: DeployHelper = new DeployHelper(borrower);
            let newlyCreatedToken: PoolToken = await deployHelper.pool.getPoolToken(newPoolToken);

            expect(await newlyCreatedToken.name()).eq('Open Borrow Pool Tokens');
            expect(await newlyCreatedToken.symbol()).eq('OBPT');
            expect(await newlyCreatedToken.decimals()).eq(18);
        });
    });

}