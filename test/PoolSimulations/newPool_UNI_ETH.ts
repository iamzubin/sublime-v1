import { createEnvironment, calculateNewPoolAddress, createNewPool } from '../../utils/createEnv';
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
} from '../../utils/types';

import hre from 'hardhat';
const { ethers } = hre;
import { Contracts } from '../../existingContracts/compound.json';
import { ERC20 } from '@typechain/ERC20';
import { BigNumber, BigNumberish } from '@ethersproject/bignumber';
import DeployHelper from '../../utils/deploys';
import { IYield } from '@typechain/IYield';
import { sha256 } from '@ethersproject/sha2';

import {
    WBTCWhale,
    WhaleAccount,
    Binance7,
    ChainLinkAggregators,
    extensionParams,
    repaymentParams,
    testPoolFactoryParams,
    createPoolParams,
    // zeroAddress,
} from '../../utils/constants-Additions';
import { zeroAddress } from '@utils/constants';

describe.only('Pool using Compound Strategy for UNI/WBTC', async () => {
    let env: Environment;

    let UNITokenContract: ERC20;
    let WBTCTokenContract: ERC20;

    before(async () => {
        env = await createEnvironment(
            hre,
            [WBTCWhale, WhaleAccount, Binance7],
            [
                { asset: Contracts.UNI, liquidityToken: Contracts.cUNI },
                { asset: Contracts.WBTC, liquidityToken: Contracts.cWBTC2 },
            ] as CompoundPair[],
            [] as YearnPair[],
            [
                { tokenAddress: Contracts.UNI, feedAggregator: ChainLinkAggregators['UNI/USD'] },
                { tokenAddress: Contracts.WBTC, feedAggregator: ChainLinkAggregators['BTC/USD'] },
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
            { _protocolFeeFraction: testPoolFactoryParams._protocolFeeFraction } as CreditLineInitParams
        );
    });

    it('Sample Environment for pool creation', async function () {
        // console.log(env.entities.admin); //Getting all the users for the pool
        console.log("Borrow Token: ", env.mockTokenContracts[0].name);
        console.log("Collateral Token: ", env.mockTokenContracts[1].name);
    });

    it("Create Pool Test with compound yeild UNI/WBTC", async function () {
        // Getting signers
        let whaleAccount = await ethers.provider.getSigner(WhaleAccount);
        let wbtcWhale = await ethers.provider.getSigner(WBTCWhale);

        // Getting the borrow and collateral token contracts
        UNITokenContract = env.mockTokenContracts[0].contract;
        WBTCTokenContract = env.mockTokenContracts[1].contract;

        // Getting mock tokens from holders into the admin
        await UNITokenContract.connect(whaleAccount).transfer(env.entities.admin.address, BigNumber.from('10').pow(23)); // 10,000 UNI
        await WBTCTokenContract.connect(wbtcWhale).transfer(env.entities.admin.address, BigNumber.from('10').pow(10)); // 100 BTC

        // Getting the yield instance for the selected strategy
        let helper: DeployHelper = new DeployHelper(env.entities.admin);
        let iyield: IYield = await helper.mock.getYield(env.yields.compoundYield.address);

        // Calculating the random seed for the transaction
        let salt = sha256(Buffer.from(`borrower-${new Date().valueOf()}`));

        // Generating the address of the pool
        let generatedPoolAddress = await calculateNewPoolAddress(
            env,
            UNITokenContract,
            WBTCTokenContract,
            iyield,
            salt,
            false,
            {
                _poolSize: createPoolParams._poolSize,
                _minborrowAmount: createPoolParams._minborrowAmount,
                _borrowRate: createPoolParams._borrowRate,
                _collateralAmount: createPoolParams._collateralAmountForWBTC,
                _collateralRatio: createPoolParams._collateralRatio,
                _collectionPeriod: createPoolParams._collectionPeriod,
                _matchCollateralRatioInterval: createPoolParams._loanWithdrawalDuration,
                _noOfRepaymentIntervals: createPoolParams._noOfRepaymentIntervals,
                _repaymentInterval: createPoolParams._repaymentInterval
            } as PoolCreateParams
        );

        console.log("Generated pool Address: ", generatedPoolAddress);
        await WBTCTokenContract.connect(env.entities.admin).transfer(env.entities.borrower.address, createPoolParams._collateralAmountForWBTC.mul(2)); // Transfer quantity to borrower
        await WBTCTokenContract.connect(env.entities.borrower).approve(generatedPoolAddress, createPoolParams._collateralAmountForWBTC.mul(2));
        console.log("Approved!");

        let generatedPool = await createNewPool(
            env,
            UNITokenContract,
            WBTCTokenContract,
            iyield,
            salt,
            false,
            {
                _poolSize: createPoolParams._poolSize,
                _minborrowAmount: createPoolParams._minborrowAmount,
                _borrowRate: createPoolParams._borrowRate,
                _collateralAmount: createPoolParams._collateralAmount,
                _collateralRatio: createPoolParams._collateralRatio,
                _collectionPeriod: createPoolParams._collectionPeriod,
                _matchCollateralRatioInterval: createPoolParams._loanWithdrawalDuration,
                _noOfRepaymentIntervals: createPoolParams._noOfRepaymentIntervals,
                _repaymentInterval: createPoolParams._repaymentInterval
            } as PoolCreateParams
        );
        console.log("Generated Pool: ", generatedPool);
        
    });    
});
