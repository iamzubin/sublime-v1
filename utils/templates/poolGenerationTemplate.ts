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
    WBTCWhale,
    WhaleAccount,
    Binance7,
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
                [WBTCWhale, WhaleAccount, Binance7],
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
            // poolFactory is already initialized as env.poolFactory

            //poolImpl = await deployHelper.pool.deployPool(); //env.poolLogic  (implemented by function createPool)
            //poolTokenImpl = await deployHelper.pool.deployPoolToken(); //env.poolTokenLogic (implemented by function createPoolToken)
            //repaymentImpl = await deployHelper.pool.deployRepayments();  // env.repayments (Already done by the function createRepaymentsWithInit)
        });    
        it('create pools', async() => {
            console.log("createEnvironment() executed successfully.")
            let {admin, borrower, lender} = env.entities;

            await env.poolFactory
                .connect(admin)
                .updateVolatilityThreshold(env.mockTokenContracts[0].contract.address, testPoolFactoryParams._collateralVolatilityThreshold);
            await env.poolFactory
                .connect(admin)
                .updateVolatilityThreshold(env.mockTokenContracts[1].contract.address, testPoolFactoryParams._collateralVolatilityThreshold);
            
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
                createPoolParams
            );
            
            console.log("calculateNewPoolAddress() is executed successfully.")
            
            const nonce = (await env.poolFactory.provider.getTransactionCount(env.poolFactory.address)) + 1;
            let newPoolToken: string = getContractAddress({
                from: env.poolFactory.address,
                nonce,
            });
            console.log("getContractAddress() is executed successfully.")

            let {
                _poolSize,
                _minborrowAmount,
                _collateralRatio,
                _borrowRate,
                _repaymentInterval,
                _noOfRepaymentIntervals,
                _collateralAmount,
            } = createPoolParams;

            await collateralToken.connect(admin).transfer(borrower.address, _collateralAmount.mul(2)); // Transfer quantity to borrower
            await collateralToken.approve(generatedPoolAddress, _collateralAmount.mul(2));
            console.log("collateralToken transfers took place.");

            await expect(
                env.poolFactory
                    .connect(borrower)
                    .createPool(
                        _poolSize,
                        _minborrowAmount,
                        Contracts.DAI,
                        Contracts.LINK,
                        _collateralRatio,
                        _borrowRate,
                        _repaymentInterval,
                        _noOfRepaymentIntervals,
                        env.yields.aaveYield.address,
                        _collateralAmount,
                        false,
                        sha256(Buffer.from('borrower'))
                    )
            )
                .to.emit(env.poolFactory, 'PoolCreated')
                .withArgs(generatedPoolAddress, borrower.address, newPoolToken);

            let deployHelper: DeployHelper = new DeployHelper(borrower);
            let newlyCreatedToken: PoolToken = await deployHelper.pool.getPoolToken(newPoolToken);

            expect(await newlyCreatedToken.name()).eq('Open Borrow Pool Tokens');
            expect(await newlyCreatedToken.symbol()).eq('OBPT');
            expect(await newlyCreatedToken.decimals()).eq(18);
        });
    });

}