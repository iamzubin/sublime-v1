import { calculateNewPoolAddress, createEnvironment, createNewPool } from '../../utils/createEnv';
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
const { ethers, network } = hre;
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
    creditLineFactoryParams,
} from '../../utils/constants-rahul';

import DeployHelper from '../../utils/deploys';
import { ERC20 } from '../../typechain/ERC20';
import { sha256 } from '@ethersproject/sha2';
import { BigNumber, BigNumberish } from 'ethers';
import { IYield } from '@typechain/IYield';
import { Address } from 'hardhat-deploy/dist/types';
import { Pool } from '@typechain/Pool';
import { CreditLine } from '../../typechain/CreditLine';
import { zeroAddress } from '../../utils/constants';
import { getPoolInitSigHash } from '../../utils/createEnv/poolLogic';
import { expectApproxEqual } from '../../utils/helpers';
import { incrementChain, timeTravel, blockTravel } from '../../utils/time';
import { isAddress } from 'ethers/lib/utils';

describe('CreditLine, Borrow Token: USDT, CollateralToken: ETH', async () => {
    let env: Environment;
    let pool: Pool;
    let poolAddress: Address;

    let deployHelper: DeployHelper;
    let BorrowAsset: ERC20;
    let CollateralAsset: ERC20;
    let iyield: IYield;
    let creditLine: CreditLine;

    let borrowLimit: BigNumber;
    let collateralAmout: BigNumber;
    let _liquidationThreshold: BigNumber;
    let amountForDeposit: BigNumber;
    let _borrowRate: BigNumberish;
    let _autoLiquidation: boolean;
    let _collateralRatio: BigNumberish;
    let _borrowAsset: string;
    let _collateralAsset: string;
    let values: BigNumber;
    let valuesNew: BigNumber;
    before(async () => {
        env = await createEnvironment(
            hre,
            [WBTCWhale, WhaleAccount, Binance7],
            [
                { asset: Contracts.USDT, liquidityToken: Contracts.cUSDT },
                { asset: zeroAddress, liquidityToken: Contracts.cETH },
            ] as CompoundPair[],
            [] as YearnPair[],
            [
                { tokenAddress: zeroAddress, feedAggregator: ChainLinkAggregators['ETH/USD'] },
                { tokenAddress: Contracts.USDT, feedAggregator: ChainLinkAggregators['USDT/USD'] },
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
    });

    it('Sample', async function () {
        let salt = sha256(Buffer.from(`borrower-${new Date().valueOf()}`)); // one pool factory - one salt => 1 unique pool
        let { admin, borrower, lender } = env.entities;
        let deployHelper: DeployHelper = new DeployHelper(admin);
        let USDT: ERC20 = await deployHelper.mock.getMockERC20(Contracts.USDT);
        let ETH: ERC20 = await deployHelper.mock.getMockERC20(zeroAddress); // this is made into type only for matching the signature
        let iyield: IYield = await deployHelper.mock.getYield(env.yields.compoundYield.address);

        let poolAddress = await calculateNewPoolAddress(env, USDT, ETH, iyield, salt, false, {
            _poolSize: BigNumber.from(100).mul(BigNumber.from(10).pow(6)), // max possible borrow tokens in pool
            _borrowRate: BigNumber.from(5).mul(BigNumber.from(10).pow(28)), // 100 * 10^28 in contract means 100% to outside
            _collateralAmount: BigNumber.from(1).mul(BigNumber.from(10).pow(18)), // 1 eth
            _collateralRatio: BigNumber.from(250).mul(BigNumber.from(10).pow(28)), //250 * 10**28
            _collectionPeriod: 10000,
            _loanWithdrawalDuration: 200,
            _noOfRepaymentIntervals: 100,
            _repaymentInterval: 1000,
        });

        console.log({ calculatedPoolAddress: poolAddress });

        console.log(env.mockTokenContracts[1].name);
        await env.mockTokenContracts[1].contract.connect(env.impersonatedAccounts[0]).transfer(admin.address, '100000000');
        await env.mockTokenContracts[1].contract.connect(admin).transfer(borrower.address, '100000000');
        await env.mockTokenContracts[1].contract.connect(borrower).approve(poolAddress, '100000000');

        let pool = await createNewPool(env, USDT, ETH, iyield, salt, false, {
            _poolSize: BigNumber.from(100).mul(BigNumber.from(10).pow(6)), // max possible borrow tokens in pool
            _borrowRate: BigNumber.from(5).mul(BigNumber.from(10).pow(28)), // 100 * 10^28 in contract means 100% to outside
            _collateralAmount: BigNumber.from(1).mul(BigNumber.from(10).pow(18)), // 1 eth
            _collateralRatio: BigNumber.from(250).mul(BigNumber.from(10).pow(28)), //250 * 10**28
            _collectionPeriod: 10000,
            _loanWithdrawalDuration: 200,
            _noOfRepaymentIntervals: 100,
            _repaymentInterval: 1000,
        });

        console.log({ actualPoolAddress: pool.address });
        assert.equal(poolAddress, pool.address, 'Generated and Actual pool address should match');
    });

    it('CreditLine Request: Borrower and Lender cannot be same', async function () {
        let { admin, borrower, lender } = env.entities;
        creditLine = env.creditLine;
        let CTDecimals = BigNumber.from('18');
        let BTDecimals = await env.mockTokenContracts[0].contract.decimals();

        borrowLimit = BigNumber.from('10').mul(BigNumber.from('10').pow(BTDecimals));
        collateralAmout = BigNumber.from('10').mul(BigNumber.from('10').pow(CTDecimals));
        amountForDeposit = BigNumber.from('100');
        _liquidationThreshold = BigNumber.from(100);
        _borrowRate = BigNumber.from(1).mul(BigNumber.from('10').pow(28));
        _autoLiquidation = true;
        _collateralRatio = BigNumber.from(200);
        _borrowAsset = env.mockTokenContracts[0].contract.address;
        _collateralAsset = env.mockTokenContracts[1].contract.address;

        await expect(
            creditLine
                .connect(lender)
                .request(lender.address, borrowLimit, _borrowRate, _autoLiquidation, _collateralRatio, _borrowAsset, _collateralAsset, true)
        ).to.be.revertedWith('Lender and Borrower cannot be same addresses');
    });

    it('CreditLine Request: Should revert if price oracle does not exist', async function () {
        let { admin, borrower, lender } = env.entities;
        creditLine = env.creditLine;

        await expect(
            creditLine.connect(lender).request(
                borrower.address,
                borrowLimit,
                _borrowRate,
                _autoLiquidation,
                _collateralRatio,
                Contracts.BAT, // Using a different borrow token
                _collateralAsset,
                true
            )
        ).to.be.revertedWith('R: No price feed');
    });

    it('Creditline Request: Check for correct request', async function () {
        let { admin, borrower, lender } = env.entities;
        creditLine = env.creditLine;

        values = await creditLine
            .connect(lender)
            .callStatic.request(
                borrower.address,
                borrowLimit,
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

    it('Creditline Active: Cannot deposit collateral when credit line not in active stage', async function () {
        let { admin, borrower, lender } = env.entities;
        let random = env.entities.extraLenders[10];
        let random1 = env.entities.extraLenders[20];

        valuesNew = await creditLine
            .connect(random1)
            .callStatic.request(
                borrower.address,
                borrowLimit,
                _borrowRate,
                _autoLiquidation,
                _collateralRatio,
                _borrowAsset,
                _collateralAsset,
                true
            );

        await expect(
            creditLine
                .connect(random1)
                .request(
                    borrower.address,
                    borrowLimit,
                    _borrowRate,
                    _autoLiquidation,
                    _collateralRatio,
                    _borrowAsset,
                    _collateralAsset,
                    true
                )
        )
            .to.emit(creditLine, 'CreditLineRequested')
            .withArgs(valuesNew, random1.address, borrower.address);

        await env.mockTokenContracts[1].contract.connect(env.impersonatedAccounts[0]).transfer(admin.address, collateralAmout);
        await env.mockTokenContracts[1].contract.connect(admin).transfer(random.address, collateralAmout);
        await env.mockTokenContracts[1].contract.connect(random).approve(creditLine.address, collateralAmout);

        await expect(
            creditLine.connect(random).depositCollateral(valuesNew, collateralAmout, env.yields.compoundYield.address, false)
        ).to.be.revertedWith('CreditLine not active');
    });

    it('Creditline Active: cannot borrow from creditline if not active', async function () {
        let { admin, borrower, lender } = env.entities;
        let amount: BigNumber = BigNumber.from('100');

        await env.mockTokenContracts[1].contract.connect(env.impersonatedAccounts[0]).transfer(admin.address, amount);
        await env.mockTokenContracts[1].contract.connect(admin).approve(borrower.address, amount);

        await expect(creditLine.connect(borrower).borrow(valuesNew, amount)).to.be.revertedWith(
            'CreditLine: The credit line is not yet active.'
        );
    });

    it('Creditline Active: Deposit Collateral directly from wallet', async function () {
        let { admin, borrower, lender } = env.entities;
        let random = env.entities.extraLenders[10];

        // await expect(creditLine.connect(borrower).accept(values)).to.emit(creditLine, 'CreditLineAccepted').withArgs(values);

        let liquidityShares = await env.yields.compoundYield.callStatic.getSharesForTokens(amountForDeposit, _collateralAsset);
        // console.log({ amountForDeposit: amountForDeposit.toString() });
        // console.log({ liquidityShares: liquidityShares.toString() });

        await env.mockTokenContracts[1].contract.connect(env.impersonatedAccounts[0]).transfer(admin.address, amountForDeposit);
        await env.mockTokenContracts[1].contract.connect(admin).transfer(random.address, amountForDeposit);
        await env.mockTokenContracts[1].contract.connect(random).approve(creditLine.address, amountForDeposit);

        const collateralBalanceInShares = await env.savingsAccount
            .connect(admin)
            .balanceInShares(creditLine.address, _collateralAsset, env.yields.compoundYield.address);

        // const randomBalanceInShares = await env.mockTokenContracts[1].contract.balanceOf(random.address);
        const randomBalanceInShares = await ethers.provider.getBalance(random.address);

        await creditLine
            .connect(random)
            .depositCollateral(values, amountForDeposit, env.yields.compoundYield.address, false, { value: 100 });

        const collateralBalanceInSharesAfter = await env.savingsAccount
            .connect(admin)
            .balanceInShares(creditLine.address, _collateralAsset, env.yields.compoundYield.address);

        // const randomBalanceInSharesAfter = await env.mockTokenContracts[1].contract.balanceOf(random.address);
        const randomBalanceInSharesAfter = await ethers.provider.getBalance(random.address);

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

        // await expect(creditLine.connect(borrower).accept(values)).to.emit(creditLine, 'CreditLineAccepted').withArgs(values);

        let liquidityShares = await env.yields.compoundYield.callStatic.getTokensForShares(amountForDeposit, _collateralAsset);
        // console.log({ amountForDeposit: amountForDeposit.toString() });
        // console.log({ liquidityShares: liquidityShares.toString() });

        await env.mockTokenContracts[1].contract.connect(env.impersonatedAccounts[0]).transfer(admin.address, collateralAmout);
        await env.mockTokenContracts[1].contract.connect(admin).transfer(random.address, collateralAmout);
        await env.mockTokenContracts[1].contract.connect(random).approve(env.yields.compoundYield.address, liquidityShares.mul(100));
        await env.savingsAccount.connect(random).approve(liquidityShares.mul(100), _collateralAsset, creditLine.address);
        await env.savingsAccount
            .connect(random)
            .deposit(liquidityShares.mul(100), _collateralAsset, env.yields.compoundYield.address, random.address, {
                value: 2004797987900,
            });

        const collateralBalanceInShares = await env.savingsAccount
            .connect(admin)
            .balanceInShares(creditLine.address, _collateralAsset, env.yields.compoundYield.address);

        const randomBalanceInShares = await env.savingsAccount
            .connect(admin)
            .balanceInShares(random.address, _collateralAsset, env.yields.compoundYield.address);

        console.log('Random address', random.address);
        await creditLine.connect(random).depositCollateral(values, amountForDeposit, env.yields.compoundYield.address, true);

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

        await expect(creditLine.connect(borrower).borrow(values, amount)).to.be.revertedWith('CreditLine: Amount exceeds borrow limit.');
    });

    it('Creditline Active: collateral ratio should not go down after borrow', async function () {
        let { admin, borrower, lender } = env.entities;
        let BTDecimals = await env.mockTokenContracts[0].contract.decimals();
        let amount: BigNumber = BigNumber.from('10').mul(BigNumber.from('10').pow(BTDecimals));

        await expect(creditLine.connect(borrower).borrow(values, amount)).to.be.revertedWith(
            "CreditLine::borrow - The current collateral ratio doesn't allow to withdraw the amount"
        );
    });

    it('Creditline Active: Borrower borrows amount', async function () {
        let { admin, borrower, lender } = env.entities;
        let BTDecimals = await env.mockTokenContracts[0].contract.decimals();
        let CTDecimals = BigNumber.from('18');
        let lenderAmount = BigNumber.from('100').mul(BigNumber.from('10').pow(BTDecimals));
        let borrowerCollateral = BigNumber.from('500').mul(BigNumber.from('10').pow(CTDecimals));
        let borrowAmount = BigNumber.from('1').mul(BigNumber.from('10').pow(BTDecimals));
        let unlimited = BigNumber.from(10).pow(60);

        await env.mockTokenContracts[0].contract.connect(env.impersonatedAccounts[1]).transfer(admin.address, lenderAmount);
        await env.mockTokenContracts[0].contract.connect(admin).transfer(lender.address, lenderAmount);
        await env.mockTokenContracts[0].contract.connect(lender).approve(env.yields.compoundYield.address, lenderAmount);
        // Extra approval for usdt
        // await env.mockTokenContracts[0].contract.connect(lender).safeApprove(env.mockTokenContracts[0].contract.address, lenderAmount);

        await env.mockTokenContracts[1].contract.connect(env.impersonatedAccounts[0]).transfer(admin.address, borrowerCollateral);
        await env.mockTokenContracts[1].contract.connect(admin).transfer(borrower.address, borrowerCollateral);
        await env.mockTokenContracts[1].contract.connect(borrower).approve(creditLine.address, borrowerCollateral);

        await creditLine.connect(borrower).depositCollateral(values, borrowerCollateral, env.yields.compoundYield.address, false, {
            value: ethers.utils.parseEther('500'),
        });

        await env.savingsAccount
            .connect(lender)
            .deposit(lenderAmount, env.mockTokenContracts[0].contract.address, env.yields.compoundYield.address, lender.address);
        console.log('Check1');
        await env.savingsAccount.connect(lender).approve(unlimited, env.mockTokenContracts[0].contract.address, creditLine.address);

        console.log('Check2');
        const BorrowerBalance = await env.mockTokenContracts[0].contract.balanceOf(borrower.address);
        await creditLine.connect(borrower).borrow(values, borrowAmount);
        const BorrowerBalanceAfter = await env.mockTokenContracts[0].contract.balanceOf(borrower.address);
        const ProtocolFeeCollector = await env.mockTokenContracts[0].contract.balanceOf(
            await creditLine.connect(borrower).protocolFeeCollector()
        );
        let BorrowReceipt = BorrowerBalanceAfter.sub(BorrowerBalance);
        console.log({ BorrowReceipt: BorrowReceipt.toString() });
        console.log({ ProtocolFeeCollector: ProtocolFeeCollector.toString() });
        console.log(BorrowReceipt.add(ProtocolFeeCollector).toString());

        const principal = await creditLine.connect(borrower).creditLineVariables(values);
        const protocolFeeFraction = await creditLine.connect(borrower).protocolFeeFraction();
        const Expectedprincipal = borrowAmount.sub(borrowAmount.mul(protocolFeeFraction).div(BigNumber.from('10').pow(30)));
        console.log({ principal: principal.principal.toString() });
        console.log({ principalTillLastUpdate: principal.interestAccruedTillLastPrincipalUpdate.toString() });
        console.log({ Expectedprincipal: Expectedprincipal.toString() });
    });

    it('CreditLine Active: Repayments cannot be done for inactive credit lines', async function () {
        let { admin, borrower, lender } = env.entities;
        let _amount = BigNumber.from('100'); //Random amount

        await expect(creditLine.connect(borrower).repay(valuesNew, _amount, false)).to.be.revertedWith(
            'CreditLine: The credit line is not yet active.'
        );
    });

    it('CreditLine Active: Repayment interest calculations should be correct', async function () {
        let { admin, borrower, lender } = env.entities;
        const block = await ethers.provider.getBlock(await ethers.provider.getBlockNumber());
        const interval = BigNumber.from(block.timestamp).add(10); // block time stamp
        await blockTravel(network, parseInt(interval.toString()));
        let interestDue = await creditLine.connect(admin).calculateInterestAccrued(values);
        // console.log({ interestDue: interestDue.toString() });

        const _creditVars = await creditLine.connect(borrower).creditLineVariables(values);
        const _yearTime = 365 * 24 * 60 * 60;
        const scaler = BigNumber.from('10').pow(30);
        const _interest = _creditVars.principal.mul(_borrowRate).mul(10).div(scaler).div(_yearTime);
        // console.log({ _interest: _interest.toString() });

        assert(
            interestDue.toString() == _interest.toString(),
            `Calculated interest does not match actual interest. Expected ${_interest.toString()} Actual ${interestDue.toString()}`
        );
    });

    it('CreditLine Active: random address should not be able to close the loan', async function () {
        let { admin, borrower, lender } = env.entities;
        let random = env.entities.extraLenders[31];

        await expect(creditLine.connect(random).close(values)).to.be.revertedWith(
            'CreditLine: Permission denied while closing Line of credit'
        );
    });

    it('CreditLine Active: Inactive creditlines cannot be closed', async function () {
        let { admin, borrower, lender } = env.entities;
        let random1 = env.entities.extraLenders[20];

        await expect(creditLine.connect(random1).close(valuesNew)).to.be.revertedWith('CreditLine: Credit line should be active.');
    });

    // Fails
    it('CreditLine Active: Unpaid creditlines cannot be closed', async function () {
        let { admin, borrower, lender } = env.entities;

        await expect(creditLine.connect(lender).close(values)).to.be.revertedWith('CreditLine: Cannot be closed since not repaid.');
    });

    it('CreditLine Active: Only borrower can withdraw collateral from creditline', async function () {
        let { admin, borrower, lender } = env.entities;
        let random = env.entities.extraLenders[40];

        await expect(creditLine.connect(random).withdrawCollateral(values, 100, false)).to.be.revertedWith(
            'Only credit line Borrower can access'
        );
    });

    it('CreditLine Active: inactive creditline withdraw should be reverted', async function () {
        let { admin, borrower, lender } = env.entities;
        let random1 = env.entities.extraLenders[20];

        await expect(creditLine.connect(random1).withdrawCollateral(valuesNew, 100, false)).to.be.revertedWith(
            'Only credit line Borrower can access'
        );
    });

    it('CreditLine Active: Collateral can be withdrawn if collateral ratio is maintained', async function () {
        let { admin, borrower, lender } = env.entities;
        let CTDecimals = BigNumber.from('18');
        let withdrawAmount = BigNumber.from('1').mul(BigNumber.from('10').pow(CTDecimals));
        // let withdrawAmount = BigNumber.from('100');
        await creditLine.connect(borrower).withdrawCollateral(values, withdrawAmount, false);
    });

    it('CreditLine Active: collateral withdraw should be reverted if collateral ratio goes below ideal', async function () {
        let { admin, borrower, lender } = env.entities;
        let CTDecimals = BigNumber.from('18');
        let withdrawAmount = BigNumber.from('500').mul(BigNumber.from('10').pow(CTDecimals));

        await expect(creditLine.connect(borrower).withdrawCollateral(values, withdrawAmount, false)).to.be.revertedWith(
            'Collateral ratio cant go below ideal'
        );
    });

    it('CreditLine Active: collateral withdraw should be reverted if deposited collateral amount is exceeded', async function () {
        let { admin, borrower, lender } = env.entities;
        let CTDecimals = BigNumber.from('18');
        let withdrawAmount = BigNumber.from('1000').mul(BigNumber.from('10').pow(CTDecimals));

        await expect(creditLine.connect(borrower).withdrawCollateral(values, withdrawAmount, false)).to.be.revertedWith(
            'Collateral ratio cant go below ideal'
        );
    });

    it('CreditLine Close: Close creditline with event emits and status update', async function () {
        let { admin, borrower, lender } = env.entities;
        let random1 = env.entities.extraLenders[20];
        await expect(creditLine.connect(borrower).accept(valuesNew)).to.emit(creditLine, 'CreditLineAccepted').withArgs(valuesNew);

        await env.mockTokenContracts[1].contract.connect(env.impersonatedAccounts[0]).transfer(admin.address, collateralAmout);
        await env.mockTokenContracts[1].contract.connect(admin).transfer(borrower.address, collateralAmout);
        await env.mockTokenContracts[1].contract.connect(borrower).approve(creditLine.address, collateralAmout);

        await creditLine.connect(borrower).depositCollateral(valuesNew, collateralAmout, env.yields.compoundYield.address, false, {
            value: ethers.utils.parseEther('10'),
        });

        const CreditVars = await creditLine.connect(borrower).creditLineVariables(valuesNew);
        // console.log({ Principal: CreditVars.principal.toString() });
        // console.log({ Interest: CreditVars.interestAccruedTillLastPrincipalUpdate.toString() });

        await expect(creditLine.connect(random1).close(valuesNew)).to.emit(creditLine, 'CreditLineClosed').withArgs(valuesNew);

        let StatusActual = (await creditLine.connect(admin).creditLineVariables(valuesNew)).status;
        assert(
            StatusActual.toString() == BigNumber.from('3').toString(),
            `Creditline should be in closed Stage. Expected: ${BigNumber.from('3').toString()} 
            Actual: ${StatusActual}`
        );
    });
});
