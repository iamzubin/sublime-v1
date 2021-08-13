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

export async function astaYami(
    BorrowTokenParam: Address,
    CollateralTokenParam: Address,
    liquidityBorrowTokenParam: Address,
    liquidityCollateralTokenParam: Address,
    chainlinkBorrowParam: Address,
    ChainlinkCollateralParam: Address
): Promise<any> {
    describe("Pool", async() => {
        let env:Environment;
        let iyield: IYield;
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
                    { tokenAddress: CollateralTokenParam, feedAggregator: ChainlinkCollateralParam },
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
            console.log("Checkpoint 6")
            await env.poolFactory.connect(env.entities.admin).updateSupportedBorrowTokens(BorrowTokenParam, true);

            await env.poolFactory.connect(env.entities.admin).updateSupportedCollateralTokens(CollateralTokenParam, true);
            await env.poolFactory.connect(env.entities.admin).updateVolatilityThreshold(CollateralTokenParam, testPoolFactoryParams._collateralVolatilityThreshold);
            await env.poolFactory
                .connect(env.entities.admin)
                .updateVolatilityThreshold(Contracts.LINK, testPoolFactoryParams._collateralVolatilityThreshold);
            console.log("Checkpoint 7")

            let deployHelper: DeployHelper = new DeployHelper(env.entities.borrower);
            let collateralToken: ERC20 = await deployHelper.mock.getMockERC20(Contracts.LINK); //Compare this with CollateralTokenParam. Which should go in generatePoolAddress parameters
            let borrowToken: ERC20 = await deployHelper.mock.getMockERC20(BorrowTokenParam)
            let salt = sha256(Buffer.from(`borrower-${new Date().valueOf()}`));

            console.log("Checkpoint 5")

            let generatedPoolAddress: Address = await calculateNewPoolAddress(
                env,
                borrowToken,
                collateralToken,
                env.yields.compoundYield,
                salt,
                false,
                createPoolParams
            );
            
            console.log("Checkpoint 3")
            const nonce = (await env.poolFactory.provider.getTransactionCount(env.poolFactory.address)) + 1;
            let newPoolToken: string = getContractAddress({
                from: env.poolFactory.address,
                nonce,
            });
            console.log("Checkpoint 4")

            // console.log({
            //   generatedPoolAddress,
            //   msgSender: borrower.address,
            //   newPoolToken,
            //   savingsAccountFromPoolFactory: await poolFactory.savingsAccount(),
            //   savingsAccount: savingsAccount.address,
            //   "nonce": nonce
            // });

            let {
                _poolSize,
                _minborrowAmount,
                _collateralRatio,
                _borrowRate,
                _repaymentInterval,
                _noOfRepaymentIntervals,
                _collateralAmount,
            } = createPoolParams;

            console.log("Checkpoint 1");
            await collateralToken.connect(env.entities.admin).transfer(env.entities.borrower.address, _collateralAmount.mul(2)); // Transfer quantity to borrower

            await collateralToken.approve(generatedPoolAddress, _collateralAmount.mul(2));
            console.log("Checkpoint 2");

            await expect(
                env.poolFactory
                    .connect(env.entities.borrower)
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
                .withArgs(generatedPoolAddress, env.entities.borrower.address, newPoolToken);

            let newlyCreatedToken: PoolToken = await deployHelper.pool.getPoolToken(newPoolToken);

            expect(await newlyCreatedToken.name()).eq('Open Borrow Pool Tokens');
            expect(await newlyCreatedToken.symbol()).eq('OBPT');
            expect(await newlyCreatedToken.decimals()).eq(18);
        });
    });

}