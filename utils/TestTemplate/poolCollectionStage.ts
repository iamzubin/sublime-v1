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
import { Contracts } from '../../existingContracts/compound.json';
import { expect, assert } from 'chai';

import {
    WBTCWhale,
    WhaleAccount,
    Binance7,
    ChainLinkAggregators,
    extensionParams,
    repaymentParams,
    testPoolFactoryParams,
    zeroAddress,
} from '../constants-Additions';

import DeployHelper from '../deploys';
import { ERC20 } from '../../typechain/ERC20';
import { sha256 } from '@ethersproject/sha2';
import { BigNumber, ethers } from 'ethers';
import { IYield } from '@typechain/IYield';
import { Address } from 'hardhat-deploy/dist/types';
import { Pool } from '@typechain/Pool';
import { PoolToken } from '@typechain/PoolToken';
import { CompoundYield } from '@typechain/CompoundYield';

export async function poolCollectionStage(
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
            [WBTCWhale, WhaleAccount, Binance7],
            [
                { asset: BorrowToken, liquidityToken: liquidityBorrowToken},
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
            { _protocolFeeFraction: testPoolFactoryParams._protocolFeeFraction } as CreditLineInitParams
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
            _collateralAmount: BigNumber.from(1).mul(BigNumber.from(10).pow(CTDecimals)),
            _collateralRatio: BigNumber.from(250).mul(BigNumber.from(10).pow(28)),
            _collectionPeriod: 10000,
            _matchCollateralRatioInterval: 200,
            _noOfRepaymentIntervals: 100,
            _repaymentInterval: 1000,
        });

        console.log({ calculatedPoolAddress: poolAddress });

        console.log("Borrow Token: ", env.mockTokenContracts[0].name);
        console.log("Collateral Token: ", env.mockTokenContracts[1].name);
        
        await env.mockTokenContracts[1].contract.connect(env.impersonatedAccounts[0]).transfer(admin.address, BigNumber.from(1).mul(BigNumber.from(10).pow(CTDecimals)));
        await env.mockTokenContracts[1].contract.connect(admin).transfer(borrower.address, BigNumber.from(1).mul(BigNumber.from(10).pow(CTDecimals)));
        await env.mockTokenContracts[1].contract.connect(borrower).approve(poolAddress, BigNumber.from(1).mul(BigNumber.from(10).pow(CTDecimals)));

        pool = await createNewPool(env, BorrowAsset, CollateralAsset, iyield, salt, false, {
            _poolSize: BigNumber.from(100).mul(BigNumber.from(10).pow(BTDecimals)),
            _minborrowAmount: BigNumber.from(10).mul(BigNumber.from(10).pow(BTDecimals)),
            _borrowRate: BigNumber.from(1).mul(BigNumber.from(10).pow(28)),
            _collateralAmount: BigNumber.from(1).mul(BigNumber.from(10).pow(CTDecimals)),
            _collateralRatio: BigNumber.from(250).mul(BigNumber.from(10).pow(28)),
            _collectionPeriod: 10000,
            _matchCollateralRatioInterval: 200,
            _noOfRepaymentIntervals: 100,
            _repaymentInterval: 1000,
        });

        console.log({ actualPoolAddress: pool.address });
        
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

        let SharesBefore = (await pool.poolVars()).baseLiquidityShares;

        let CheckCollateralAddress = await ethers.utils.getAddress(Collateral);

        await expect(pool.connect(borrower).depositCollateral(depositAmount,false))
            .to.emit(env.savingsAccount, 'Deposited')
            .withArgs(pool.address,depositAmount,CheckCollateralAddress,env.yields.compoundYield.address);

        let SharesAfter = (await pool.poolVars()).baseLiquidityShares;

        let SharesReceived = SharesAfter.sub(SharesBefore);
        console.log({SharesReceived: SharesReceived.toNumber()});

        // Checking shares received and matching with the deposited amount
        // let liquidityShares = await env.yields.compoundYield.getSharesForTokens(depositAmount,Collateral);
        // let value = liquidityShares.value;
        // console.log(value.toString());
    });

    it('Borrower should be able to deposit Collateral to the pool using Savings Account', async function () {
        let { admin, borrower, lender } = env.entities;
        let CTDecimals = await env.mockTokenContracts[1].contract.decimals();
        let CTAddress = await env.mockTokenContracts[1].contract.address;
        let depositAmount = BigNumber.from(1).mul(BigNumber.from(10).pow(CTDecimals));

        let liquidityShares = await env.yields.compoundYield.connect(borrower).getSharesForTokens(depositAmount,CTAddress);
        console.log({ LiquidityShares: (liquidityShares.value).toString()}); // Value is zero
        
        // Transfering again as the initial amount was used for initial deposit
        await env.mockTokenContracts[1].contract.connect(env.impersonatedAccounts[0]).transfer(admin.address, depositAmount);
        await env.mockTokenContracts[1].contract.connect(admin).transfer(borrower.address, depositAmount);
        await env.mockTokenContracts[1].contract.connect(borrower).approve(env.yields.compoundYield.address, depositAmount);

        // console.log("Using SavingsAccount now!");
        await env.savingsAccount.connect(borrower).approve(env.mockTokenContracts[1].contract.address, pool.address, depositAmount);
        await env.savingsAccount.connect(borrower).depositTo(depositAmount, env.mockTokenContracts[1].contract.address, env.yields.compoundYield.address, borrower.address);

        // console.log("Deposit!");
        await expect(pool.connect(borrower).depositCollateral(depositAmount,true))
            .to.emit(env.savingsAccount, 'Transfer');
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
        await env.savingsAccount.connect(lender).depositTo(amount, env.mockTokenContracts[0].contract.address, zeroAddress, lender.address);
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

    it('Borrower should be able to cancel the pool with penalty charges', async function () {
        let { admin, borrower, lender } = env.entities;
        let BTDecimals = await env.mockTokenContracts[0].contract.decimals();

        const amount = BigNumber.from(10).mul(BigNumber.from(10).pow(BTDecimals));
        const poolTokenBalanceBefore = await poolToken.balanceOf(lender.address);
        const poolTokenTotalSupplyBefore = await poolToken.totalSupply();

        //Lenders lend borrow Tokens into the pool
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

        await poolToken.connect(lender)['burn(address,uint256)'](lender.address,amount);
        console.log("Checkpoint 2");

        //borrower cancels the pool
        await pool.connect(borrower).cancelPool();

        console.log("Checkpoint 1");

        // lender should be able to burn tokens
        // await poolToken.allowance(admin.address, lender.address)
        // await poolToken.connect(lender).burnFrom(lender.address, amount);
        

        const poolTokenBalanceAfterCancel = await poolToken.balanceOf(lender.address);
        const poolTokenTotalSupplyAfterCancel = await poolToken.totalSupply();

        console.log(poolTokenBalanceBefore.toString());
        console.log(poolTokenBalanceAfter.toString());
        console.log(poolTokenBalanceAfterCancel.toString());

        console.log(poolTokenTotalSupplyBefore.toString());
        console.log(poolTokenTotalSupplyAfter.toString());
        console.log(poolTokenTotalSupplyAfterCancel.toString());
    });
});
}