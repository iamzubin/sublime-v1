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
    creditLineFactoryParams,
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
import { CreditLine } from '../../typechain/CreditLine';
import { Contracts } from '../../existingContracts/compound.json';
import { expectApproxEqual } from '../helpers';
import { incrementChain, timeTravel, blockTravel } from '../../utils/time';

export async function CreditLines(
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
    describe('CreditLines: Requesting credit lines', async () => {
        let env: Environment;
        let pool: Pool;
        let poolAddress: Address;
        let poolToken: PoolToken;

        let deployHelper: DeployHelper;
        let BorrowAsset: ERC20;
        let CollateralAsset: ERC20;
        let iyield: IYield;
        let creditLine: CreditLine;
        let Compound: CompoundYield;

        before(async () => {
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
                _volatilityThreshold: BigNumber.from(20).mul(BigNumber.from(10).pow(28)),
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

            console.log('Borrow Token: ', env.mockTokenContracts[0].name);
            console.log('Collateral Token: ', env.mockTokenContracts[1].name);
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
                _volatilityThreshold: BigNumber.from(20).mul(BigNumber.from(10).pow(28)),
                _borrowRate: BigNumber.from(1).mul(BigNumber.from(10).pow(28)),
                _collateralAmount: BigNumber.from(Amount).mul(BigNumber.from(10).pow(CTDecimals)),
                // _collateralAmount: BigNumber.from(1).mul(BigNumber.from(10).pow(CTDecimals)),
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

        it('CreditLine Request: Borrower and Lender cannot be same', async function () {
            let { admin, borrower, lender } = env.entities;
            let borrowLimit: BigNumber = BigNumber.from('10').mul('1000000000000000000'); // 10e18
            let _liquidationThreshold: BigNumberish = BigNumber.from(100);
            let _borrowRate: BigNumberish = BigNumber.from(1).mul(BigNumber.from('10').pow(28));
            let _autoLiquidation: boolean = true;
            let _collateralRatio: BigNumberish = BigNumber.from(200);
            let _borrowAsset: string = env.mockTokenContracts[0].contract.address;
            let _collateralAsset: string = env.mockTokenContracts[1].contract.address;

            creditLine = env.creditLine;

            await expect(
                creditLine
                    .connect(lender)
                    .request(
                        lender.address,
                        borrowLimit,
                        _liquidationThreshold,
                        _borrowRate,
                        _autoLiquidation,
                        _collateralRatio,
                        _borrowAsset,
                        _collateralAsset,
                        true
                    )
            ).to.be.revertedWith('Lender and Borrower cannot be same addresses');
        });

        it('CreditLine Request: Should revert if price oracle does not exist', async function () {
            let { admin, borrower, lender } = env.entities;
            let borrowLimit: BigNumber = BigNumber.from('10').mul('1000000000000000000'); // 10e18
            let _liquidationThreshold: BigNumberish = BigNumber.from(100);
            let _borrowRate: BigNumberish = BigNumber.from(1).mul(BigNumber.from('10').pow(28));
            let _autoLiquidation: boolean = true;
            let _collateralRatio: BigNumberish = BigNumber.from(200);
            let _borrowAsset: string = env.mockTokenContracts[0].contract.address;
            let _collateralAsset: string = env.mockTokenContracts[1].contract.address;

            creditLine = env.creditLine;

            await expect(
                creditLine.connect(lender).request(
                    borrower.address,
                    borrowLimit,
                    _liquidationThreshold,
                    _borrowRate,
                    _autoLiquidation,
                    _collateralRatio,
                    Contracts.BAT, // Using a different borrow token
                    _collateralAsset,
                    true
                )
            ).to.be.revertedWith('CL: No price feed');
        });

        it('CreditLine Request: Should revert if collateral ratio is less than liquidation threshold', async function () {
            let { admin, borrower, lender } = env.entities;
            let borrowLimit: BigNumber = BigNumber.from('10').mul('1000000000000000000'); // 10e18
            let _liquidationThreshold: BigNumberish = BigNumber.from(100);
            let _borrowRate: BigNumberish = BigNumber.from(1).mul(BigNumber.from('10').pow(28));
            let _autoLiquidation: boolean = true;
            let _collateralRatio: BigNumberish = BigNumber.from(50);
            let _borrowAsset: string = env.mockTokenContracts[0].contract.address;
            let _collateralAsset: string = env.mockTokenContracts[1].contract.address;

            creditLine = env.creditLine;

            await expect(
                creditLine
                    .connect(lender)
                    .request(
                        borrower.address,
                        borrowLimit,
                        _liquidationThreshold,
                        _borrowRate,
                        _autoLiquidation,
                        _collateralRatio,
                        _borrowAsset,
                        _collateralAsset,
                        true
                    )
            ).to.be.revertedWith('CL: collateral ratio should be higher');
        });

        it('Creditline Request: Check for correct request', async function () {
            let { admin, borrower, lender } = env.entities;
            let borrowLimit: BigNumber = BigNumber.from('10').mul('1000000000000000000'); // 10e18
            let _liquidationThreshold: BigNumberish = BigNumber.from(100);
            let _borrowRate: BigNumberish = BigNumber.from(1).mul(BigNumber.from('10').pow(28));
            let _autoLiquidation: boolean = true;
            let _collateralRatio: BigNumberish = BigNumber.from(200);
            let _borrowAsset: string = env.mockTokenContracts[0].contract.address;
            let _collateralAsset: string = env.mockTokenContracts[1].contract.address;

            creditLine = env.creditLine;

            let values = await creditLine
                .connect(lender)
                .callStatic.request(
                    borrower.address,
                    borrowLimit,
                    _liquidationThreshold,
                    _borrowRate,
                    _autoLiquidation,
                    _collateralRatio,
                    _borrowAsset,
                    _collateralAsset,
                    true
                );

            await expect(
                creditLine
                    .connect(lender)
                    .request(
                        borrower.address,
                        borrowLimit,
                        _liquidationThreshold,
                        _borrowRate,
                        _autoLiquidation,
                        _collateralRatio,
                        _borrowAsset,
                        _collateralAsset,
                        true
                    )
            )
                .to.emit(creditLine, 'CreditLineRequested')
                .withArgs(values, lender.address, borrower.address);

            let StatusActual = (await creditLine.connect(admin).creditLineVariables(values)).status;
            assert(
                StatusActual.toString() == BigNumber.from('1').toString(),
                `Creditline should be in requested Stage. Expected: ${BigNumber.from('1').toString()} 
                Actual: ${StatusActual}`
            );
        });

        it('Creditline Active: Accepting credit lines', async function () {
            let { admin, borrower, lender } = env.entities;
            let borrowLimit: BigNumber = BigNumber.from('10').mul('1000000000000000000'); // 10e18
            let _liquidationThreshold: BigNumberish = BigNumber.from(100);
            let _borrowRate: BigNumberish = BigNumber.from(1).mul(BigNumber.from('10').pow(28));
            let _autoLiquidation: boolean = true;
            let _collateralRatio: BigNumberish = BigNumber.from(200);
            let _borrowAsset: string = env.mockTokenContracts[0].contract.address;
            let _collateralAsset: string = env.mockTokenContracts[1].contract.address;

            creditLine = env.creditLine;

            let values = await creditLine
                .connect(lender)
                .callStatic.request(
                    borrower.address,
                    borrowLimit,
                    _liquidationThreshold,
                    _borrowRate,
                    _autoLiquidation,
                    _collateralRatio,
                    _borrowAsset,
                    _collateralAsset,
                    true
                );

            await expect(
                creditLine
                    .connect(lender)
                    .request(
                        borrower.address,
                        borrowLimit,
                        _liquidationThreshold,
                        _borrowRate,
                        _autoLiquidation,
                        _collateralRatio,
                        _borrowAsset,
                        _collateralAsset,
                        true
                    )
            )
                .to.emit(creditLine, 'CreditLineRequested')
                .withArgs(values, lender.address, borrower.address);

            await expect(creditLine.connect(lender).accept(values)).to.be.revertedWith(
                "Only Borrower or Lender who hasn't requested can accept"
            );

            await expect(creditLine.connect(borrower).accept(values)).to.emit(creditLine, 'CreditLineAccepted').withArgs(values);

            let StatusActual = (await creditLine.connect(admin).creditLineVariables(values)).status;
            assert(
                StatusActual.toString() == BigNumber.from('2').toString(),
                `Creditline should be in requested Stage. Expected: ${BigNumber.from('2').toString()} 
                Actual: ${StatusActual}`
            );
        });
    });

    describe('Creditline Active tests', async function () {
        let env: Environment;
        let pool: Pool;
        let poolAddress: Address;
        let poolToken: PoolToken;

        let deployHelper: DeployHelper;
        let BorrowAsset: ERC20;
        let CollateralAsset: ERC20;
        let iyield: IYield;
        let creditLine: CreditLine;
        let Compound: CompoundYield;

        let borrowLimit: BigNumber;
        let collateralAmout: BigNumber;
        let amountForDeposit: BigNumber;
        let _liquidationThreshold: BigNumberish;
        let _borrowRate: BigNumberish;
        let _autoLiquidation: boolean;
        let _collateralRatio: BigNumberish;
        let _borrowAsset: string;
        let _collateralAsset: string;
        let values: any;

        before(async () => {
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
                _volatilityThreshold: BigNumber.from(20).mul(BigNumber.from(10).pow(28)),
                _borrowRate: BigNumber.from(1).mul(BigNumber.from(10).pow(28)),
                _collateralAmount: BigNumber.from(Amount).mul(BigNumber.from(10).pow(CTDecimals)),
                // _collateralAmount: BigNumber.from(1).mul(BigNumber.from(10).pow(CTDecimals)),
                _collateralRatio: BigNumber.from(250).mul(BigNumber.from(10).pow(28)),
                _collectionPeriod: 10000,
                _loanWithdrawalDuration: 200,
                _noOfRepaymentIntervals: 100,
                _repaymentInterval: 1000,
            });

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
                _volatilityThreshold: BigNumber.from(20).mul(BigNumber.from(10).pow(28)),
                _borrowRate: BigNumber.from(1).mul(BigNumber.from(10).pow(28)),
                _collateralAmount: BigNumber.from(Amount).mul(BigNumber.from(10).pow(CTDecimals)),
                // _collateralAmount: BigNumber.from(1).mul(BigNumber.from(10).pow(CTDecimals)),
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

            borrowLimit = BigNumber.from('10').mul(BigNumber.from('10').pow(BTDecimals));
            collateralAmout = BigNumber.from('10').mul(BigNumber.from('10').pow(CTDecimals));
            amountForDeposit = BigNumber.from('100');
            _liquidationThreshold = BigNumber.from(100);
            _borrowRate = BigNumber.from(1).mul(BigNumber.from('10').pow(28));
            _autoLiquidation = true;
            _collateralRatio = BigNumber.from(200);
            _borrowAsset = env.mockTokenContracts[0].contract.address;
            _collateralAsset = env.mockTokenContracts[1].contract.address;

            creditLine = env.creditLine;

            values = await creditLine
                .connect(lender)
                .callStatic.request(
                    borrower.address,
                    borrowLimit,
                    _liquidationThreshold,
                    _borrowRate,
                    _autoLiquidation,
                    _collateralRatio,
                    _borrowAsset,
                    _collateralAsset,
                    true
                );

            await expect(
                creditLine
                    .connect(lender)
                    .request(
                        borrower.address,
                        borrowLimit,
                        _liquidationThreshold,
                        _borrowRate,
                        _autoLiquidation,
                        _collateralRatio,
                        _borrowAsset,
                        _collateralAsset,
                        true
                    )
            )
                .to.emit(creditLine, 'CreditLineRequested')
                .withArgs(values, lender.address, borrower.address);
        });

        it('Creditline Active: Cannot deposit collateral when credit line not in active stage', async function () {
            let { admin, borrower, lender } = env.entities;
            let random = env.entities.extraLenders[10];

            await env.mockTokenContracts[1].contract.connect(env.impersonatedAccounts[0]).transfer(admin.address, collateralAmout);
            await env.mockTokenContracts[1].contract.connect(admin).transfer(random.address, collateralAmout);
            await env.mockTokenContracts[1].contract.connect(random).approve(creditLine.address, collateralAmout);

            await expect(creditLine.connect(random).depositCollateral(values, collateralAmout, false)).to.be.revertedWith(
                'CreditLine not active'
            );
        });

        it('Creditline Active: cannot borrow from creditline if not active', async function () {
            let { admin, borrower, lender } = env.entities;
            let amount: BigNumber = BigNumber.from('100');

            await env.mockTokenContracts[1].contract.connect(env.impersonatedAccounts[0]).transfer(admin.address, amount);
            await env.mockTokenContracts[1].contract.connect(admin).approve(borrower.address, amount);

            await expect(creditLine.connect(borrower).borrow(values, amount)).to.be.revertedWith(
                'CreditLine: The credit line is not yet active.'
            );
        });

        xit('Creditline Active: Deposit Collateral directly from wallet', async function () {
            let { admin, borrower, lender } = env.entities;
            let random = env.entities.extraLenders[10];

            await expect(creditLine.connect(borrower).accept(values)).to.emit(creditLine, 'CreditLineAccepted').withArgs(values);

            let liquidityShares = await env.yields.compoundYield.callStatic.getSharesForTokens(amountForDeposit, _collateralAsset);
            // console.log({ amountForDeposit: amountForDeposit.toString() });
            // console.log({ liquidityShares: liquidityShares.toString() });

            await env.mockTokenContracts[1].contract.connect(env.impersonatedAccounts[0]).transfer(admin.address, amountForDeposit);
            await env.mockTokenContracts[1].contract.connect(admin).transfer(random.address, amountForDeposit);
            await env.mockTokenContracts[1].contract.connect(random).approve(creditLine.address, amountForDeposit);

            const collateralBalanceInShares = await env.savingsAccount
                .connect(admin)
                .balanceInShares(creditLine.address, _collateralAsset, env.yields.compoundYield.address);

            const randomBalanceInShares = await env.mockTokenContracts[1].contract.balanceOf(random.address);

            await creditLine.connect(random).depositCollateral(values, amountForDeposit, false);

            const collateralBalanceInSharesAfter = await env.savingsAccount
                .connect(admin)
                .balanceInShares(creditLine.address, _collateralAsset, env.yields.compoundYield.address);

            const randomBalanceInSharesAfter = await env.mockTokenContracts[1].contract.balanceOf(random.address);

            const collateralBalanceInSharesDiff = collateralBalanceInSharesAfter.sub(collateralBalanceInShares);
            const randomBalanceInSharesDiff = randomBalanceInShares.sub(randomBalanceInSharesAfter);
            // console.log({ collateralBalanceInSharesDiff: collateralBalanceInSharesDiff.toString() });
            // console.log({ randomBalanceInSharesDiff: randomBalanceInSharesDiff.toString() });

            expectApproxEqual(liquidityShares, collateralBalanceInSharesDiff, 50);
            expectApproxEqual(randomBalanceInSharesDiff, amountForDeposit, 50);
        });

        it('Creditline Active: Deposit Collateral from savings account', async function () {
            let { admin, borrower, lender } = env.entities;
            let random = env.entities.extraLenders[10];

            await expect(creditLine.connect(borrower).accept(values)).to.emit(creditLine, 'CreditLineAccepted').withArgs(values);

            let liquidityShares = await env.yields.compoundYield.callStatic.getTokensForShares(amountForDeposit, _collateralAsset);
            // console.log({ amountForDeposit: amountForDeposit.toString() });
            // console.log({ liquidityShares: liquidityShares.toString() });

            await env.mockTokenContracts[1].contract.connect(env.impersonatedAccounts[0]).transfer(admin.address, collateralAmout);
            await env.mockTokenContracts[1].contract.connect(admin).transfer(random.address, collateralAmout);
            await env.mockTokenContracts[1].contract.connect(random).approve(env.yields.compoundYield.address, liquidityShares.mul(100));
            await env.savingsAccount.connect(random).approve(liquidityShares.mul(100), _collateralAsset, creditLine.address);
            await env.savingsAccount
                .connect(random)
                .deposit(liquidityShares.mul(100), _collateralAsset, env.yields.compoundYield.address, random.address);

            const collateralBalanceInShares = await env.savingsAccount
                .connect(admin)
                .balanceInShares(creditLine.address, _collateralAsset, env.yields.compoundYield.address);

            const randomBalanceInShares = await env.savingsAccount
                .connect(admin)
                .balanceInShares(random.address, _collateralAsset, env.yields.compoundYield.address);

            await creditLine.connect(random).depositCollateral(values, amountForDeposit, true);

            const collateralBalanceInSharesAfter = await env.savingsAccount
                .connect(admin)
                .balanceInShares(creditLine.address, _collateralAsset, env.yields.compoundYield.address);

            const randomBalanceInSharesAfter = await env.savingsAccount
                .connect(admin)
                .balanceInShares(random.address, _collateralAsset, env.yields.compoundYield.address);

            const collateralBalanceInSharesDiff = collateralBalanceInSharesAfter.sub(collateralBalanceInShares);
            const randomBalanceInSharesDiff = randomBalanceInShares.sub(randomBalanceInSharesAfter);
            // console.log({ collateralBalanceInSharesDiff: collateralBalanceInSharesDiff.toString() });
            // console.log({ randomBalanceInSharesDiff: randomBalanceInSharesDiff.toString() });

            let sharesReceived = await env.yields.compoundYield.callStatic.getSharesForTokens(amountForDeposit, _collateralAsset);
            // console.log({ amountForDeposit: amountForDeposit.toString() });
            // console.log({ sharesReceived: sharesReceived.toString() });

            expectApproxEqual(sharesReceived, collateralBalanceInSharesDiff, 50);
            expectApproxEqual(randomBalanceInSharesDiff, collateralBalanceInSharesDiff, 50);
        });

        it('Only borrower can borrow from creditline', async function () {
            let { admin, borrower, lender } = env.entities;
            let random = env.entities.extraLenders[10];
            let random1 = env.entities.extraLenders[20];
            let amount: BigNumber = BigNumber.from('100');

            await env.mockTokenContracts[1].contract.connect(env.impersonatedAccounts[0]).transfer(admin.address, amount);
            await env.mockTokenContracts[1].contract.connect(admin).approve(random1.address, amount);

            await expect(creditLine.connect(random1).borrow(values, amount)).to.be.revertedWith('Only credit line Borrower can access');
        });

        it('Creditline Active: cannot borrow from creditline if borrow amount exceeds limit', async function () {
            let { admin, borrower, lender } = env.entities;
            let BTDecimals = await env.mockTokenContracts[0].contract.decimals();
            let amount: BigNumber = BigNumber.from('100').mul(BigNumber.from('10').pow(BTDecimals));

            await expect(creditLine.connect(borrower).borrow(values, amount)).to.be.revertedWith(
                'CreditLine: Amount exceeds borrow limit.'
            );
        });

        it('Creditline Active: collateral ratio should not go down after withdraw', async function () {
            let { admin, borrower, lender } = env.entities;
            let amount: BigNumber = BigNumber.from('100');

            await expect(creditLine.connect(borrower).borrow(values, amount)).to.be.revertedWith(
                "CreditLine::borrow - The current collateral ratio doesn't allow to withdraw the amount"
            );
        });

        xit('Creditline Active: Borrower borrows amount', async function () {
            let { admin, borrower, lender } = env.entities;
            let amount: BigNumber = BigNumber.from('100');
            let deposit: BigNumber = BigNumber.from('10000');

            await env.mockTokenContracts[1].contract.connect(env.impersonatedAccounts[0]).transfer(admin.address, deposit);
            await env.mockTokenContracts[1].contract.connect(admin).transfer(borrower.address, deposit);
            await env.mockTokenContracts[1].contract.connect(borrower).approve(creditLine.address, deposit);

            await creditLine.connect(borrower).depositCollateral(values, deposit, false);

            let strategy = env.yields.compoundYield.address;

            await env.mockTokenContracts[0].contract.connect(env.impersonatedAccounts[1]).transfer(admin.address, amount);
            await env.mockTokenContracts[0].contract.connect(admin).transfer(lender.address, amount);
            await env.mockTokenContracts[0].contract.connect(lender).approve(strategy, amount);
            await env.savingsAccount.connect(lender).approve(amount, _borrowAsset, borrower.address);
            await env.savingsAccount.connect(lender).deposit(amount, _borrowAsset, strategy, lender.address);

            let Lender_balance = await env.savingsAccount.connect(admin).callStatic.balanceInShares(lender.address, _borrowAsset, strategy);
            console.log(Lender_balance.toString());
            await creditLine.connect(borrower).borrow(values, amount);
        });
    });
}
