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
    createPoolParams,
    WhaleAccount,
    zeroAddress,
    ChainLinkAggregators,
} from '../constants-Additions';

import DeployHelper from '../deploys';
import { ERC20 } from '../../typechain/ERC20';
import { sha256 } from '@ethersproject/sha2';
import { BigNumber, BigNumberish } from 'ethers';
import { IYield } from '@typechain/IYield';
import { Address } from 'hardhat-deploy/dist/types';
import { Pool } from '@typechain/Pool';
import { PoolToken } from '@typechain/PoolToken';
import { CompoundYield } from '@typechain/CompoundYield';
import { expectApproxEqual } from '../helpers';
import { incrementChain, timeTravel, blockTravel } from '../../utils/time';

export async function compound_RequestExtension(
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
    describe('Pool Simulation: Borrower Requests Extension', async () => {
        let env: Environment;
        let pool: Pool;
        let poolAddress: Address;
        let poolToken: PoolToken;

        let deployHelper: DeployHelper;
        let BorrowAsset: ERC20;
        let CollateralAsset: ERC20;
        let iyield: IYield;
        let Compound: CompoundYield;

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
            await lendExpect.to.emit(poolToken, 'Transfer').withArgs(zeroAddress, lender.address, amount);

            // Approving Borrow tokens to the lender1
            await borrowToken.connect(env.impersonatedAccounts[1]).transfer(admin.address, amount1);
            await borrowToken.connect(admin).transfer(lender1.address, amount1);
            await borrowToken.connect(lender1).approve(poolAddress, amount1);

            // Lender1 lends into the pool
            const lendExpect1 = expect(pool.connect(lender1).lend(lender1.address, amount1, false));
            await lendExpect1.to.emit(pool, 'LiquiditySupplied').withArgs(amount1, lender1.address);
            await lendExpect1.to.emit(poolToken, 'Transfer').withArgs(zeroAddress, lender1.address, amount1);

            //block travel to escape withdraw interval
            const { loanStartTime } = await pool.poolConstants();
            await blockTravel(network, parseInt(loanStartTime.add(1).toString()));

            // Borrower withdraws borrow tokens
            await pool.connect(borrower).withdrawBorrowedAmount();
        });

        it('Only borrower should be able to request extension', async function () {
            let { admin, borrower, lender } = env.entities;
            let random = env.entities.extraLenders[10];

            console.log('Borrow Token: ', env.mockTokenContracts[0].name);
            console.log('Collateral Token: ', env.mockTokenContracts[1].name);

            // Requesting margin call
            await expect(env.extenstion.connect(random).requestExtension(pool.address)).to.be.revertedWith('Not Borrower');
            await expect(env.extenstion.connect(lender).requestExtension(pool.address)).to.be.revertedWith('Not Borrower');
            await env.extenstion.connect(borrower).requestExtension(pool.address);
        });

        it('Extension passes only when majority lenders vote', async function () {
            let { admin, borrower, lender } = env.entities;
            let lender1 = env.entities.extraLenders[3];

            await env.extenstion.connect(borrower).requestExtension(pool.address);
            await env.extenstion.connect(lender1).voteOnExtension(pool.address);
            await env.extenstion.connect(lender).voteOnExtension(pool.address);
            const { isLoanExtensionActive } = await env.repayments.connect(admin).repaymentVars(pool.address);
            assert(isLoanExtensionActive, 'Extension not active');
        });

        it("Can't vote after extension is passed", async () => {
            let { admin, borrower, lender } = env.entities;
            let lender1 = env.entities.extraLenders[3];

            await env.extenstion.connect(borrower).requestExtension(pool.address);
            await env.extenstion.connect(lender).voteOnExtension(pool.address);
            const { isLoanExtensionActive } = await env.repayments.connect(admin).repaymentVars(pool.address);
            assert(isLoanExtensionActive, 'Extension not active');
            await expect(env.extenstion.connect(lender1).voteOnExtension(pool.address)).to.be.revertedWith(
                'Pool::voteOnExtension - Voting is over'
            );
        });

        it('Cannot liquidate pool after extension is passed', async () => {
            let { admin, borrower, lender } = env.entities;
            let random = env.entities.extraLenders[10];

            await env.extenstion.connect(borrower).requestExtension(pool.address);
            await env.extenstion.connect(lender).voteOnExtension(pool.address);
            const { isLoanExtensionActive } = await env.repayments.connect(admin).repaymentVars(pool.address);
            assert(isLoanExtensionActive, 'Extension not active');
            await expect(pool.connect(random).liquidatePool(false, false, false)).to.be.revertedWith(
                'Pool::liquidatePool - No reason to liquidate the pool'
            );
        });

        it('Should be able to repay after extension is passed', async () => {
            let { admin, borrower, lender } = env.entities;
            let random = env.entities.extraLenders[10];
            let borrowToken = env.mockTokenContracts[0].contract;
            const scaler = BigNumber.from(10).pow(30);

            await env.extenstion.connect(borrower).requestExtension(pool.address);
            await env.extenstion.connect(lender).voteOnExtension(pool.address);
            const { isLoanExtensionActive } = await env.repayments.connect(admin).repaymentVars(pool.address);
            assert(isLoanExtensionActive, 'Extension not active');

            let interestForCurrentPeriod = (await env.repayments.connect(admin).getInterestDueTillInstalmentDeadline(pool.address)).div(
                scaler
            );
            const endOfExtension: BigNumber = (await env.repayments.connect(admin).getNextInstalmentDeadline(pool.address)).div(scaler);

            await borrowToken.connect(env.impersonatedAccounts[1]).transfer(admin.address, interestForCurrentPeriod);
            await borrowToken.connect(admin).transfer(random.address, interestForCurrentPeriod);
            await borrowToken.connect(random).approve(env.repayments.address, interestForCurrentPeriod);
            await env.repayments.connect(random).repayAmount(pool.address, interestForCurrentPeriod);

            const gracePeriod: BigNumber = repaymentParams.gracePeriodFraction.mul(createPoolParams._repaymentInterval).div(scaler);
            await blockTravel(network, parseInt(endOfExtension.add(gracePeriod).add(1).toString()));

            interestForCurrentPeriod = (await env.repayments.connect(admin).getInterestDueTillInstalmentDeadline(pool.address)).div(scaler);
            assert(
                interestForCurrentPeriod.toString() != '0',
                `Interest not charged correctly. Actual: ${interestForCurrentPeriod.toString()} Expected: 0`
            );

            await borrowToken.connect(env.impersonatedAccounts[1]).transfer(admin.address, interestForCurrentPeriod);
            await borrowToken.connect(admin).transfer(random.address, interestForCurrentPeriod);
            await borrowToken.connect(random).approve(env.repayments.address, interestForCurrentPeriod);
            await env.repayments.connect(random).repayAmount(pool.address, interestForCurrentPeriod);
        });
    });
}
