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
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { ERC20Detailed } from '@typechain/ERC20Detailed';
import { SavingsAccount } from '@typechain/SavingsAccount';
import { incrementChain, timeTravel, blockTravel } from '../../utils/time';
import { isAddress } from 'ethers/lib/utils';

let snapshotId: any;

describe('Create Snapshot', async () => {
    it('Trying Creating Snapshot', async () => {
        snapshotId = await network.provider.request({
            method: 'evm_snapshot',
            params: [],
        });
    });
});

describe('CreditLine, Borrow Token: ETH, CollateralToken: WBTC', async () => {
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
                { asset: zeroAddress, liquidityToken: Contracts.cETH },
                { asset: Contracts.WBTC, liquidityToken: Contracts.cWBTC2 },
            ] as CompoundPair[],
            [] as YearnPair[],
            [
                { tokenAddress: Contracts.WBTC, feedAggregator: ChainLinkAggregators['BTC/USD'] },
                { tokenAddress: zeroAddress, feedAggregator: ChainLinkAggregators['ETH/USD'] },
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

    it('Sample pool', async function () {
        let salt = sha256(Buffer.from(`borrower-${new Date().valueOf()}`)); // one pool factory - one salt => 1 unique pool
        let { admin, borrower, lender } = env.entities;
        let deployHelper: DeployHelper = new DeployHelper(admin);
        let WBTC: ERC20 = await deployHelper.mock.getMockERC20(Contracts.WBTC);
        let ETH: ERC20 = await deployHelper.mock.getMockERC20(zeroAddress); // this is made into type only for matching the signature
        let iyield: IYield = await deployHelper.mock.getYield(env.yields.compoundYield.address);

        let poolAddress = await calculateNewPoolAddress(env, ETH, WBTC, iyield, salt, false, {
            _poolSize: BigNumber.from(100).mul(BigNumber.from(10).pow(18)), // max possible borrow tokens in pool
            _borrowRate: BigNumber.from(5).mul(BigNumber.from(10).pow(28)), // 100 * 10^28 in contract means 100% to outside
            _collateralAmount: BigNumber.from(100).mul(BigNumber.from(10).pow(8)), // 100 btc
            _collateralRatio: BigNumber.from(250).mul(BigNumber.from(10).pow(28)), //250 * 10**28
            _collectionPeriod: 10000,
            _loanWithdrawalDuration: 200,
            _noOfRepaymentIntervals: 100,
            _repaymentInterval: 1000,
        });

        console.log({ calculatedPoolAddress: poolAddress });

        console.log(env.mockTokenContracts[1].name);
        await env.mockTokenContracts[1].contract.connect(env.impersonatedAccounts[0]).transfer(admin.address, '10000000000');
        await env.mockTokenContracts[1].contract.connect(admin).transfer(borrower.address, '10000000000');
        await env.mockTokenContracts[1].contract.connect(borrower).approve(poolAddress, '10000000000');

        let pool = await createNewPool(env, ETH, WBTC, iyield, salt, false, {
            _poolSize: BigNumber.from(100).mul(BigNumber.from(10).pow(18)), // max possible borrow tokens in pool
            _borrowRate: BigNumber.from(5).mul(BigNumber.from(10).pow(28)), // 100 * 10^28 in contract means 100% to outside
            _collateralAmount: BigNumber.from(100).mul(BigNumber.from(10).pow(8)), // 100 btc
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
        let BTDecimals = BigNumber.from('18');
        let CTDecimals = await env.mockTokenContracts[1].contract.decimals();

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

        const randomBalanceInShares = await env.mockTokenContracts[1].contract.balanceOf(random.address);
        // const randomBalanceInShares = await ethers.provider.getBalance(random.address);

        await creditLine.connect(random).depositCollateral(values, amountForDeposit, env.yields.compoundYield.address, false);

        const collateralBalanceInSharesAfter = await env.savingsAccount
            .connect(admin)
            .balanceInShares(creditLine.address, _collateralAsset, env.yields.compoundYield.address);

        const randomBalanceInSharesAfter = await env.mockTokenContracts[1].contract.balanceOf(random.address);
        // const randomBalanceInSharesAfter = await ethers.provider.getBalance(random.address);

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
            .deposit(liquidityShares.mul(100), _collateralAsset, env.yields.compoundYield.address, random.address);

        const collateralBalanceInShares = await env.savingsAccount
            .connect(admin)
            .balanceInShares(creditLine.address, _collateralAsset, env.yields.compoundYield.address);

        const randomBalanceInShares = await env.savingsAccount
            .connect(admin)
            .balanceInShares(random.address, _collateralAsset, env.yields.compoundYield.address);

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
        let BTDecimals = BigNumber.from('18');
        let amount: BigNumber = BigNumber.from('100').mul(BigNumber.from('10').pow(BTDecimals));

        await expect(creditLine.connect(borrower).borrow(values, amount)).to.be.revertedWith(
            "CreditLine::borrow - The current collateral ratio doesn't allow to withdraw the amount"
        );
    });

    it('Creditline Active: collateral ratio should not go down after borrow', async function () {
        let { admin, borrower, lender } = env.entities;
        let BTDecimals = BigNumber.from('18');
        let amount: BigNumber = BigNumber.from('100').mul(BigNumber.from('10').pow(BTDecimals));

        await expect(creditLine.connect(borrower).borrow(values, amount)).to.be.revertedWith(
            "CreditLine::borrow - The current collateral ratio doesn't allow to withdraw the amount"
        );
    });

    it('Creditline Active: Borrower borrows amount', async function () {
        let { admin, borrower, lender } = env.entities;
        let CTDecimals = await env.mockTokenContracts[1].contract.decimals();
        let BTDecimals = BigNumber.from('18');
        let lenderAmount = BigNumber.from('10').mul(BigNumber.from('10').pow(BTDecimals));
        let borrowAmount = BigNumber.from('1').mul(BigNumber.from('10').pow(BTDecimals));
        let borrowerCollateral = BigNumber.from('500');
        let unlimited = BigNumber.from(10).pow(60);

        await env.mockTokenContracts[0].contract.connect(env.impersonatedAccounts[1]).transfer(admin.address, lenderAmount);
        await env.mockTokenContracts[0].contract.connect(admin).transfer(lender.address, lenderAmount);
        await env.mockTokenContracts[0].contract.connect(lender).approve(env.yields.compoundYield.address, lenderAmount);

        await env.mockTokenContracts[1].contract.connect(env.impersonatedAccounts[0]).transfer(admin.address, borrowerCollateral);
        await env.mockTokenContracts[1].contract.connect(admin).transfer(borrower.address, borrowerCollateral);
        await env.mockTokenContracts[1].contract.connect(borrower).approve(creditLine.address, borrowerCollateral);

        await creditLine.connect(borrower).depositCollateral(values, borrowerCollateral, env.yields.compoundYield.address, false);

        await env.savingsAccount
            .connect(lender)
            .deposit(lenderAmount, env.mockTokenContracts[0].contract.address, env.yields.compoundYield.address, lender.address, {
                value: ethers.utils.parseEther('10'),
            });

        await env.savingsAccount.connect(lender).approve(unlimited, env.mockTokenContracts[0].contract.address, creditLine.address);

        // const BorrowerBalance = await env.mockTokenContracts[0].contract.balanceOf(borrower.address);
        const BorrowerBalance = await ethers.provider.getBalance(borrower.address);
        await creditLine.connect(borrower).borrow(values, borrowAmount);
        // const BorrowerBalanceAfter = await env.mockTokenContracts[0].contract.balanceOf(borrower.address);
        const BorrowerBalanceAfter = await ethers.provider.getBalance(borrower.address);
        // const ProtocolFeeCollector = await env.mockTokenContracts[0].contract.balanceOf(
        //     await creditLine.connect(borrower).protocolFeeCollector()
        // );
        const ProtocolFeeCollector = await ethers.provider.getBalance(await creditLine.connect(borrower).protocolFeeCollector());
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
        let CTDecimals = await env.mockTokenContracts[1].contract.decimals();
        let withdrawAmount = BigNumber.from('100');

        await creditLine.connect(borrower).withdrawCollateral(values, withdrawAmount, false);
    });

    it('CreditLine Active: collateral withdraw should be reverted if collateral ratio goes below ideal', async function () {
        let { admin, borrower, lender } = env.entities;
        let CTDecimals = await env.mockTokenContracts[1].contract.decimals();
        let withdrawAmount = BigNumber.from('500').mul(BigNumber.from('10').pow(CTDecimals));

        await expect(creditLine.connect(borrower).withdrawCollateral(values, withdrawAmount, false)).to.be.revertedWith(
            'Collateral ratio cant go below ideal'
        );
    });

    it('CreditLine Active: collateral withdraw should be reverted if deposited collateral amount is exceeded', async function () {
        let { admin, borrower, lender } = env.entities;
        let CTDecimals = await env.mockTokenContracts[1].contract.decimals();
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

describe(`Credit Lines ${zeroAddress}/${Contracts.WBTC}: Calculate Borrowable Amount`, async () => {
    let env: Environment;
    let creditLine: CreditLine;
    let admin: SignerWithAddress;
    let lender: SignerWithAddress;
    let borrower: SignerWithAddress;

    let deployHelper: DeployHelper;
    let Amount: any;

    before(async () => {
        env = await createEnvironment(
            hre,
            [WBTCWhale, WhaleAccount, Binance7],
            [
                { asset: zeroAddress, liquidityToken: Contracts.cETH },
                { asset: Contracts.WBTC, liquidityToken: Contracts.cWBTC2 },
            ] as CompoundPair[],
            [] as YearnPair[],
            [
                { tokenAddress: Contracts.WBTC, feedAggregator: ChainLinkAggregators['BTC/USD'] },
                { tokenAddress: zeroAddress, feedAggregator: ChainLinkAggregators['ETH/USD'] },
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

        creditLine = env.creditLine;
        admin = env.entities.admin;
        lender = env.entities.lender;
        borrower = env.entities.borrower;
        deployHelper = new DeployHelper(admin);
        Amount = BigNumber.from(100);
    });

    it('If no collateral is deposited, then borrowable amount should be 0, autoliquidation = false', async () => {
        let BorrowAsset: ERC20Detailed = await deployHelper.mock.getMockERC20Detailed(env.mockTokenContracts[0].contract.address);
        let CollateralAsset: ERC20Detailed = await deployHelper.mock.getMockERC20Detailed(env.mockTokenContracts[1].contract.address);
        let borrowDecimals = BigNumber.from(18);
        let collateralDecimals = await CollateralAsset.decimals();

        let borrowLimit = BigNumber.from(100).mul(BigNumber.from(10).pow(borrowDecimals)); // 100 units of borrow tokens
        let borrowRate = BigNumber.from(1).mul(BigNumber.from(10).pow(28)); // 1%
        let colRatio = BigNumber.from(245).mul(BigNumber.from(10).pow(28)); // 245%

        creditLine = creditLine.connect(borrower);

        let creditLineNumber = await creditLine
            .connect(borrower)
            .callStatic.request(
                lender.address,
                borrowLimit,
                borrowRate,
                true,
                colRatio,
                BorrowAsset.address,
                CollateralAsset.address,
                false
            );

        await creditLine
            .connect(borrower)
            .request(lender.address, borrowLimit, borrowRate, true, colRatio, BorrowAsset.address, CollateralAsset.address, false);

        let ba = await creditLine.callStatic.calculateBorrowableAmount(creditLineNumber);
        expectApproxEqual(ba, 0, 0);
    });
    it('Should revert if credit line is not (active) (requested)', async () => {
        let BorrowAsset: ERC20Detailed = await deployHelper.mock.getMockERC20Detailed(env.mockTokenContracts[0].contract.address);
        let CollateralAsset: ERC20Detailed = await deployHelper.mock.getMockERC20Detailed(env.mockTokenContracts[1].contract.address);
        // let borrowDecimals = await BorrowAsset.decimals();
        let borrowDecimals = BigNumber.from(18);
        let collateralDecimals = await CollateralAsset.decimals();

        let borrowLimit = BigNumber.from(100).mul(BigNumber.from(10).pow(borrowDecimals)); // 100 units of borrow tokens
        let borrowRate = BigNumber.from(1).mul(BigNumber.from(10).pow(28)); // 1%
        let colRatio = BigNumber.from(245).mul(BigNumber.from(10).pow(28)); // 245%

        creditLine = creditLine.connect(borrower);

        let creditLineNumber = await creditLine
            .connect(borrower)
            .callStatic.request(
                lender.address,
                borrowLimit,
                borrowRate,
                true,
                colRatio,
                BorrowAsset.address,
                CollateralAsset.address,
                false
            );

        await creditLine
            .connect(borrower)
            .request(lender.address, borrowLimit, borrowRate, true, colRatio, BorrowAsset.address, CollateralAsset.address, false);

        await creditLine.connect(lender).accept(creditLineNumber);
        await creditLine.connect(lender).close(creditLineNumber);
        await expect(creditLine.calculateBorrowableAmount(creditLineNumber)).to.be.revertedWith(
            'CreditLine: Cannot only if credit line ACTIVE or REQUESTED'
        );
    });

    it('In no case borrowable amount(including interest) should be more than the borrow limit, imm.. after adding the collateral', async () => {
        let BorrowAsset: ERC20Detailed = await deployHelper.mock.getMockERC20Detailed(env.mockTokenContracts[0].contract.address);
        let CollateralAsset: ERC20Detailed = await deployHelper.mock.getMockERC20Detailed(env.mockTokenContracts[1].contract.address);
        // let borrowDecimals = await BorrowAsset.decimals();
        let borrowDecimals = BigNumber.from(18);
        let collateralDecimals = await CollateralAsset.decimals();

        let borrowLimit = BigNumber.from(100).mul(BigNumber.from(10).pow(borrowDecimals)); // 100 units of borrow tokens
        let borrowRate = BigNumber.from(1).mul(BigNumber.from(10).pow(28)); // 1%
        let colRatio = BigNumber.from(245).mul(BigNumber.from(10).pow(28)); // 245%

        let collateralAmountToDeposit = BigNumber.from(Amount).mul(BigNumber.from(10).pow(collateralDecimals));

        await BorrowAsset.connect(env.impersonatedAccounts[0]).transfer(borrower.address, borrowLimit);
        // console.log({ whale1Balane: await BorrowAsset.balanceOf(WhaleAccount1) });
        // console.log({ whale2Balane: await CollateralAsset.balanceOf(WhaleAccount1) });
        await CollateralAsset.connect(env.impersonatedAccounts[0]).transfer(borrower.address, collateralAmountToDeposit);

        creditLine = creditLine.connect(borrower);

        let creditLineNumber = await creditLine
            .connect(borrower)
            .callStatic.request(
                lender.address,
                borrowLimit,
                borrowRate,
                true,
                colRatio,
                BorrowAsset.address,
                CollateralAsset.address,
                false
            );

        await creditLine
            .connect(borrower)
            .request(lender.address, borrowLimit, borrowRate, true, colRatio, BorrowAsset.address, CollateralAsset.address, false);

        await creditLine.connect(lender).accept(creditLineNumber);

        await CollateralAsset.connect(borrower).approve(creditLine.address, collateralAmountToDeposit);
        await creditLine
            .connect(borrower)
            .depositCollateral(creditLineNumber, collateralAmountToDeposit, env.yields.noYield.address, false);

        let borrowableAmount = await creditLine.connect(borrower).callStatic.calculateBorrowableAmount(creditLineNumber);

        expect(borrowableAmount).lte(borrowLimit);
    });

    it('In no case borrowable amount(including interest) should be more than the borrow limit, after borrowing some tokens and doing block/time travel, partial amount', async () => {
        let BorrowAsset: ERC20Detailed = await deployHelper.mock.getMockERC20Detailed(env.mockTokenContracts[0].contract.address);
        let CollateralAsset: ERC20Detailed = await deployHelper.mock.getMockERC20Detailed(env.mockTokenContracts[1].contract.address);
        // let borrowDecimals = await BorrowAsset.decimals();
        let borrowDecimals = BigNumber.from(18);
        let collateralDecimals = await CollateralAsset.decimals();

        let borrowLimit = BigNumber.from(100).mul(BigNumber.from(10).pow(borrowDecimals)); // 100 units of borrow tokens
        let borrowRate = BigNumber.from(1).mul(BigNumber.from(10).pow(28)); // 1%
        let colRatio = BigNumber.from(245).mul(BigNumber.from(10).pow(0)); // 245%

        // let collateralAmountToDeposit = BigNumber.from(Amount).mul(BigNumber.from(10).pow(collateralDecimals));
        let collateralAmountToDeposit = BigNumber.from(500);

        await BorrowAsset.connect(env.impersonatedAccounts[0]).transfer(lender.address, borrowLimit);
        // console.log({ whale1Balane: await BorrowAsset.balanceOf(WhaleAccount1) });
        // console.log({ whale2Balane: await CollateralAsset.balanceOf(WhaleAccount1) });
        await CollateralAsset.connect(env.impersonatedAccounts[0]).transfer(borrower.address, collateralAmountToDeposit);

        creditLine = creditLine.connect(borrower);

        let creditLineNumber = await creditLine
            .connect(borrower)
            .callStatic.request(
                lender.address,
                borrowLimit,
                borrowRate,
                true,
                colRatio,
                BorrowAsset.address,
                CollateralAsset.address,
                false
            );

        await creditLine
            .connect(borrower)
            .request(lender.address, borrowLimit, borrowRate, true, colRatio, BorrowAsset.address, CollateralAsset.address, false);

        await creditLine.connect(lender).accept(creditLineNumber);

        await CollateralAsset.connect(borrower).approve(creditLine.address, collateralAmountToDeposit);
        await creditLine
            .connect(borrower)
            .depositCollateral(creditLineNumber, collateralAmountToDeposit, env.yields.noYield.address, false);

        await BorrowAsset.connect(lender).approve(env.yields.noYield.address, borrowLimit);
        await env.savingsAccount.connect(lender).deposit(borrowLimit, BorrowAsset.address, env.yields.noYield.address, lender.address, {
            value: ethers.utils.parseEther('100'),
        });

        await env.savingsAccount.connect(lender).approve(borrowLimit, BorrowAsset.address, creditLine.address);
        await creditLine.connect(borrower).borrow(creditLineNumber, borrowLimit.div(10000)); // borrow a very small amount

        await timeTravel(network, 86400 * 10); // 10 days

        let borrowableAmount = await creditLine.connect(borrower).callStatic.calculateBorrowableAmount(creditLineNumber);

        expect(borrowableAmount).lte(borrowLimit);
    });

    it('In no case borrowable amount(including interest) should be more than the borrow limit, after borrowing some tokens and doing block/time travel, full borrow limit', async () => {
        let BorrowAsset: ERC20Detailed = await deployHelper.mock.getMockERC20Detailed(env.mockTokenContracts[0].contract.address);
        let CollateralAsset: ERC20Detailed = await deployHelper.mock.getMockERC20Detailed(env.mockTokenContracts[1].contract.address);
        // let borrowDecimals = await BorrowAsset.decimals();
        let borrowDecimals = BigNumber.from(18);
        let collateralDecimals = await CollateralAsset.decimals();

        let borrowLimit = BigNumber.from(100).mul(BigNumber.from(10).pow(borrowDecimals)); // 100 units of borrow tokens
        let borrowRate = BigNumber.from(1).mul(BigNumber.from(10).pow(28)); // 1%
        let colRatio = BigNumber.from(245).mul(BigNumber.from(10).pow(0)); // 245%

        // let collateralAmountToDeposit = BigNumber.from(Amount).mul(BigNumber.from(10).pow(collateralDecimals));
        let collateralAmountToDeposit = BigNumber.from(500);

        await BorrowAsset.connect(env.impersonatedAccounts[0]).transfer(lender.address, borrowLimit);
        // console.log({ whale1Balane: await BorrowAsset.balanceOf(WhaleAccount1) });
        // console.log({ whale2Balane: await CollateralAsset.balanceOf(WhaleAccount1) });
        await CollateralAsset.connect(env.impersonatedAccounts[0]).transfer(borrower.address, collateralAmountToDeposit);

        creditLine = creditLine.connect(borrower);

        let creditLineNumber = await creditLine
            .connect(borrower)
            .callStatic.request(
                lender.address,
                borrowLimit,
                borrowRate,
                true,
                colRatio,
                BorrowAsset.address,
                CollateralAsset.address,
                false
            );

        await creditLine
            .connect(borrower)
            .request(lender.address, borrowLimit, borrowRate, true, colRatio, BorrowAsset.address, CollateralAsset.address, false);

        await creditLine.connect(lender).accept(creditLineNumber);

        await CollateralAsset.connect(borrower).approve(creditLine.address, collateralAmountToDeposit);
        await creditLine
            .connect(borrower)
            .depositCollateral(creditLineNumber, collateralAmountToDeposit, env.yields.noYield.address, false);

        await BorrowAsset.connect(lender).approve(env.yields.noYield.address, borrowLimit);
        await env.savingsAccount.connect(lender).deposit(borrowLimit, BorrowAsset.address, env.yields.noYield.address, lender.address, {
            value: ethers.utils.parseEther('100'),
        });

        await env.savingsAccount.connect(lender).approve(borrowLimit, BorrowAsset.address, creditLine.address);
        let borrowableAmount = await creditLine.connect(borrower).callStatic.calculateBorrowableAmount(creditLineNumber);
        await creditLine.connect(borrower).borrow(creditLineNumber, borrowableAmount.mul(95).div(100)); // 95% of borrow limit

        await timeTravel(network, 86400 * 10); // 10 days

        borrowableAmount = await creditLine.connect(borrower).callStatic.calculateBorrowableAmount(creditLineNumber);

        expect(borrowableAmount).lte(borrowLimit);
    });
});

describe.skip(`Credit Lines ${zeroAddress}/${Contracts.WBTC}: Liquidate Credit Lines`, async () => {
    let env: Environment;
    let creditLine: CreditLine;
    let admin: SignerWithAddress;
    let lender: SignerWithAddress;
    let borrower: SignerWithAddress;

    let deployHelper: DeployHelper;

    let creditLineNumber: BigNumber;
    let Amount: any;

    before(async () => {
        env = await createEnvironment(
            hre,
            [WBTCWhale, WhaleAccount, Binance7],
            [
                { asset: zeroAddress, liquidityToken: Contracts.cETH },
                { asset: Contracts.WBTC, liquidityToken: Contracts.cWBTC2 },
            ] as CompoundPair[],
            [] as YearnPair[],
            [
                { tokenAddress: Contracts.WBTC, feedAggregator: ChainLinkAggregators['BTC/USD'] },
                { tokenAddress: zeroAddress, feedAggregator: ChainLinkAggregators['ETH/USD'] },
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

        creditLine = env.creditLine;
        admin = env.entities.admin;
        lender = env.entities.lender;
        borrower = env.entities.borrower;
        deployHelper = new DeployHelper(admin);
        Amount = BigNumber.from(100);
    });

    beforeEach(async () => {
        let BorrowAsset: ERC20Detailed = await deployHelper.mock.getMockERC20Detailed(env.mockTokenContracts[0].contract.address);
        let CollateralAsset: ERC20Detailed = await deployHelper.mock.getMockERC20Detailed(env.mockTokenContracts[1].contract.address);
        let borrowDecimals = BigNumber.from(18);
        let collateralDecimals = await CollateralAsset.decimals();

        let borrowLimit = BigNumber.from(100).mul(BigNumber.from(10).pow(borrowDecimals)); // 100 units of borrow tokens
        let borrowRate = BigNumber.from(1).mul(BigNumber.from(10).pow(28)); // 1%
        let colRatio = BigNumber.from(50).mul(BigNumber.from(10).pow(0)); // 245%

        // let collateralAmountToDeposit = BigNumber.from(Amount).mul(BigNumber.from(10).pow(collateralDecimals));
        let collateralAmountToDeposit = BigNumber.from(Amount);

        await BorrowAsset.connect(env.impersonatedAccounts[0]).transfer(lender.address, borrowLimit);
        // console.log({ whale1Balane: await BorrowAsset.balanceOf(WhaleAccount1) });
        // console.log({ whale2Balane: await CollateralAsset.balanceOf(WhaleAccount1) });
        await CollateralAsset.connect(env.impersonatedAccounts[0]).transfer(borrower.address, collateralAmountToDeposit);

        creditLine = creditLine.connect(borrower);

        creditLineNumber = await creditLine
            .connect(borrower)
            .callStatic.request(
                lender.address,
                borrowLimit,
                borrowRate,
                true,
                colRatio,
                BorrowAsset.address,
                CollateralAsset.address,
                false
            );

        await creditLine
            .connect(borrower)
            .request(lender.address, borrowLimit, borrowRate, true, colRatio, BorrowAsset.address, CollateralAsset.address, false);

        await creditLine.connect(lender).accept(creditLineNumber);

        await CollateralAsset.connect(borrower).approve(creditLine.address, collateralAmountToDeposit);
        await creditLine
            .connect(borrower)
            .depositCollateral(creditLineNumber, collateralAmountToDeposit, env.yields.noYield.address, false);

        await BorrowAsset.connect(lender).approve(env.yields.noYield.address, borrowLimit);
        await env.savingsAccount.connect(lender).deposit(borrowLimit, BorrowAsset.address, env.yields.noYield.address, lender.address, {
            value: ethers.utils.parseEther('100'),
        });

        await env.savingsAccount.connect(lender).approve(borrowLimit, BorrowAsset.address, creditLine.address);
        let borrowableAmount = await creditLine.connect(borrower).callStatic.calculateBorrowableAmount(creditLineNumber);
        await creditLine.connect(borrower).borrow(creditLineNumber, borrowableAmount.mul(95).div(100)); // 95% of borrow limit

        await timeTravel(network, 86400 * 10); // 10 days

        borrowableAmount = await creditLine.connect(borrower).callStatic.calculateBorrowableAmount(creditLineNumber);

        expect(borrowableAmount).lte(borrowLimit);
    });
    it('Test Liquidation', async () => {
        await creditLine.connect(admin).liquidate(creditLineNumber, true);
    });
});

describe(`Credit Lines ${zeroAddress}/${Contracts.WBTC}: Repay Credit Lines`, async () => {
    let env: Environment;
    let creditLine: CreditLine;
    let admin: SignerWithAddress;
    let lender: SignerWithAddress;
    let borrower: SignerWithAddress;

    let deployHelper: DeployHelper;

    let creditLineNumber: BigNumber;

    let BorrowAsset: ERC20Detailed;
    let CollateralAsset: ERC20Detailed;
    let savingsAccount: SavingsAccount;
    let Amount: any;

    before(async () => {
        env = await createEnvironment(
            hre,
            [WBTCWhale, WhaleAccount, Binance7],
            [
                { asset: zeroAddress, liquidityToken: Contracts.cETH },
                { asset: Contracts.WBTC, liquidityToken: Contracts.cWBTC2 },
            ] as CompoundPair[],
            [] as YearnPair[],
            [
                { tokenAddress: Contracts.WBTC, feedAggregator: ChainLinkAggregators['BTC/USD'] },
                { tokenAddress: zeroAddress, feedAggregator: ChainLinkAggregators['ETH/USD'] },
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

        creditLine = env.creditLine;
        admin = env.entities.admin;
        lender = env.entities.lender;
        borrower = env.entities.borrower;
        savingsAccount = env.savingsAccount;
        deployHelper = new DeployHelper(admin);
        Amount = BigNumber.from(100);
    });

    beforeEach(async () => {
        BorrowAsset = await deployHelper.mock.getMockERC20Detailed(env.mockTokenContracts[0].contract.address);
        CollateralAsset = await deployHelper.mock.getMockERC20Detailed(env.mockTokenContracts[1].contract.address);

        // let borrowDecimals = await BorrowAsset.decimals();
        let borrowDecimals = BigNumber.from(18);
        let collateralDecimals = await CollateralAsset.decimals();

        let borrowLimit = BigNumber.from(100).mul(BigNumber.from(10).pow(borrowDecimals)); // 100 units of borrow tokens
        let borrowRate = BigNumber.from(1).mul(BigNumber.from(10).pow(28)); // 1%
        let colRatio = BigNumber.from(245).mul(BigNumber.from(10).pow(0)); // 245%

        // let collateralAmountToDeposit = BigNumber.from(Amount).mul(BigNumber.from(10).pow(collateralDecimals));
        let collateralAmountToDeposit = BigNumber.from(500);

        await BorrowAsset.connect(env.impersonatedAccounts[0]).transfer(lender.address, borrowLimit);
        // console.log({ whale1Balane: await BorrowAsset.balanceOf(WhaleAccount1) });
        // console.log({ whale2Balane: await CollateralAsset.balanceOf(WhaleAccount1) });
        await CollateralAsset.connect(env.impersonatedAccounts[0]).transfer(borrower.address, collateralAmountToDeposit);

        creditLine = creditLine.connect(borrower);

        creditLineNumber = await creditLine
            .connect(borrower)
            .callStatic.request(
                lender.address,
                borrowLimit,
                borrowRate,
                true,
                colRatio,
                BorrowAsset.address,
                CollateralAsset.address,
                false
            );

        await creditLine
            .connect(borrower)
            .request(lender.address, borrowLimit, borrowRate, true, colRatio, BorrowAsset.address, CollateralAsset.address, false);

        await creditLine.connect(lender).accept(creditLineNumber);

        await CollateralAsset.connect(borrower).approve(creditLine.address, collateralAmountToDeposit);
        await creditLine
            .connect(borrower)
            .depositCollateral(creditLineNumber, collateralAmountToDeposit, env.yields.noYield.address, false);

        await BorrowAsset.connect(lender).approve(env.yields.noYield.address, borrowLimit);
        await env.savingsAccount.connect(lender).deposit(borrowLimit, BorrowAsset.address, env.yields.noYield.address, lender.address, {
            value: ethers.utils.parseEther('100'),
        });

        await env.savingsAccount.connect(lender).approve(borrowLimit, BorrowAsset.address, creditLine.address);
        let borrowableAmount = await creditLine.connect(borrower).callStatic.calculateBorrowableAmount(creditLineNumber);
        await creditLine.connect(borrower).borrow(creditLineNumber, borrowableAmount.mul(95).div(100)); // 95% of borrow limit

        await timeTravel(network, 86400 * 10); // 10 days

        borrowableAmount = await creditLine.connect(borrower).callStatic.calculateBorrowableAmount(creditLineNumber);

        expect(borrowableAmount).lte(borrowLimit);
    });

    it('Repay from account directly', async () => {
        // let borrowDecimals = await BorrowAsset.decimals();
        let borrowDecimals = BigNumber.from(18);
        let amountToRepay = BigNumber.from(5).mul(BigNumber.from(10).pow(borrowDecimals)); // 100 units of borrow tokens

        await BorrowAsset.connect(borrower).approve(creditLine.address, amountToRepay);
        // const borrowerBalanceBeforeRepay = await BorrowAsset.balanceOf(borrower.address);
        const borrowerBalanceBeforeRepay = await ethers.provider.getBalance(borrower.address);
        const lenderSharesBeforeRepay = await savingsAccount
            .connect(borrower)
            .balanceInShares(lender.address, BorrowAsset.address, env.yields.noYield.address);
        await creditLine.connect(borrower).repay(creditLineNumber, amountToRepay, false, { value: ethers.utils.parseEther('5') });

        // const borrowerBalanceAfterRepay = await BorrowAsset.balanceOf(borrower.address);
        const borrowerBalanceAfterRepay = await ethers.provider.getBalance(borrower.address);

        const lenderSharesAfterRepay = await savingsAccount
            .connect(borrower)
            .balanceInShares(lender.address, BorrowAsset.address, env.yields.noYield.address);
        expectApproxEqual(borrowerBalanceBeforeRepay.sub(borrowerBalanceAfterRepay), amountToRepay, 0);
        expectApproxEqual(lenderSharesAfterRepay.sub(lenderSharesBeforeRepay), amountToRepay, 0);
    });

    it('Should be able to Repay again from account directly', async () => {
        // let borrowDecimals = await BorrowAsset.decimals();
        let borrowDecimals = BigNumber.from(18);
        let amountToRepay = BigNumber.from(5).mul(BigNumber.from(10).pow(borrowDecimals)); // 100 units of borrow tokens

        await BorrowAsset.connect(borrower).approve(creditLine.address, amountToRepay);
        // const borrowerBalanceBeforeRepay = await BorrowAsset.balanceOf(borrower.address);
        const borrowerBalanceBeforeRepay = await ethers.provider.getBalance(borrower.address);
        const lenderSharesBeforeRepay = await savingsAccount
            .connect(borrower)
            .balanceInShares(lender.address, BorrowAsset.address, env.yields.noYield.address);
        await creditLine.connect(borrower).repay(creditLineNumber, amountToRepay, false, { value: ethers.utils.parseEther('5') });

        // const borrowerBalanceAfterRepay = await BorrowAsset.balanceOf(borrower.address);
        const borrowerBalanceAfterRepay = await ethers.provider.getBalance(borrower.address);

        const lenderSharesAfterRepay = await savingsAccount
            .connect(borrower)
            .balanceInShares(lender.address, BorrowAsset.address, env.yields.noYield.address);
        expectApproxEqual(borrowerBalanceBeforeRepay.sub(borrowerBalanceAfterRepay), amountToRepay, 0);
        expectApproxEqual(lenderSharesAfterRepay.sub(lenderSharesBeforeRepay), amountToRepay, 0);

        await timeTravel(network, 86400 * 10); // 10 days

        await BorrowAsset.connect(borrower).approve(creditLine.address, amountToRepay);
        await creditLine.connect(borrower).repay(creditLineNumber, amountToRepay, false, { value: ethers.utils.parseEther('5') });

        // const borrowerBalanceAfterSecondRepay = await BorrowAsset.balanceOf(borrower.address);
        const borrowerBalanceAfterSecondRepay = await ethers.provider.getBalance(borrower.address);

        const lenderSharesAfterSecondRepay = await savingsAccount
            .connect(borrower)
            .balanceInShares(lender.address, BorrowAsset.address, env.yields.noYield.address);

        expectApproxEqual(borrowerBalanceAfterRepay.sub(borrowerBalanceAfterSecondRepay), amountToRepay, 0);
        expectApproxEqual(lenderSharesBeforeRepay.sub(lenderSharesAfterSecondRepay), amountToRepay, 0);
    });

    it('Repay From Savings Account', async () => {
        // let borrowDecimals = await BorrowAsset.decimals();
        let borrowDecimals = BigNumber.from(18);
        let amountToRepay = BigNumber.from(5).mul(BigNumber.from(10).pow(borrowDecimals)); // 100 units of borrow tokens

        await BorrowAsset.connect(borrower).approve(env.yields.noYield.address, amountToRepay);
        await savingsAccount.connect(borrower).deposit(amountToRepay, BorrowAsset.address, env.yields.noYield.address, borrower.address, {
            value: ethers.utils.parseEther('5'),
        });
        await savingsAccount.connect(borrower).approve(amountToRepay, BorrowAsset.address, creditLine.address);

        const borrowerSharesBeforeRepay = await savingsAccount
            .connect(borrower)
            .balanceInShares(borrower.address, BorrowAsset.address, env.yields.noYield.address);

        const lenderSharesBeforeRepay = await savingsAccount
            .connect(borrower)
            .balanceInShares(lender.address, BorrowAsset.address, env.yields.noYield.address);
        await creditLine.connect(borrower).repay(creditLineNumber, amountToRepay, true);

        const borrowerSharesAfterRepay = await savingsAccount
            .connect(borrower)
            .balanceInShares(borrower.address, BorrowAsset.address, env.yields.noYield.address);

        const lenderSharesAfterRepay = await savingsAccount
            .connect(borrower)
            .balanceInShares(lender.address, BorrowAsset.address, env.yields.noYield.address);
        expectApproxEqual(borrowerSharesBeforeRepay.sub(borrowerSharesAfterRepay), amountToRepay, 0);
        expectApproxEqual(lenderSharesAfterRepay.sub(lenderSharesBeforeRepay), amountToRepay, 0);
    });

    it('Repay from savings account with shares being deducted from 2 strategies', async () => {
        // let borrowDecimals = await BorrowAsset.decimals();
        let borrowDecimals = BigNumber.from(18);
        let amountToRepay = BigNumber.from(10).mul(BigNumber.from(10).pow(borrowDecimals)); // 100 units of borrow tokens
        await BorrowAsset.connect(borrower).approve(env.yields.noYield.address, amountToRepay.div(2));
        await BorrowAsset.connect(borrower).approve(env.yields.compoundYield.address, amountToRepay.div(2));
        await savingsAccount
            .connect(borrower)
            .deposit(amountToRepay.div(2), BorrowAsset.address, env.yields.noYield.address, borrower.address, {
                value: ethers.utils.parseEther('5'),
            });

        await savingsAccount
            .connect(borrower)
            .deposit(amountToRepay.div(2), BorrowAsset.address, env.yields.compoundYield.address, borrower.address, {
                value: ethers.utils.parseEther('5'),
            });
        await savingsAccount.connect(borrower).approve(amountToRepay, BorrowAsset.address, creditLine.address);

        let creditLineAllowanceBefore = await savingsAccount
            .connect(borrower)
            .allowance(lender.address, BorrowAsset.address, creditLine.address);

        let borrowerSharesInNoYieldBefore = await savingsAccount
            .connect(borrower)
            .balanceInShares(borrower.address, BorrowAsset.address, env.yields.noYield.address);
        let lenderSharesInNoYieldBefore = await savingsAccount
            .connect(borrower)
            .balanceInShares(lender.address, BorrowAsset.address, env.yields.noYield.address);

        let borrowerSharesInNoCompoundYieldBefore = await savingsAccount
            .connect(borrower)
            .balanceInShares(borrower.address, BorrowAsset.address, env.yields.compoundYield.address);
        let lenderSharesInCompoundYieldBefore = await savingsAccount
            .connect(borrower)
            .balanceInShares(lender.address, BorrowAsset.address, env.yields.compoundYield.address);

        await creditLine.connect(borrower).repay(creditLineNumber, amountToRepay, true);
        let borrowerSharesInNoYieldAfter = await savingsAccount
            .connect(borrower)
            .balanceInShares(borrower.address, BorrowAsset.address, env.yields.noYield.address);
        let lenderSharesInNoYieldAfter = await savingsAccount
            .connect(borrower)
            .balanceInShares(lender.address, BorrowAsset.address, env.yields.noYield.address);

        let borrowerSharesInCompoundYieldAfter = await savingsAccount
            .connect(borrower)
            .balanceInShares(borrower.address, BorrowAsset.address, env.yields.compoundYield.address);
        let lenderSharesInCompoundYieldAfter = await savingsAccount
            .connect(borrower)
            .balanceInShares(lender.address, BorrowAsset.address, env.yields.compoundYield.address);

        let creditLineAllowanceAfter = await savingsAccount
            .connect(borrower)
            .allowance(lender.address, BorrowAsset.address, creditLine.address);

        expectApproxEqual(
            borrowerSharesInNoYieldBefore.sub(borrowerSharesInNoYieldAfter),
            lenderSharesInNoYieldAfter.sub(lenderSharesInNoYieldBefore),
            0
        );
        expectApproxEqual(
            borrowerSharesInNoCompoundYieldBefore.sub(borrowerSharesInCompoundYieldAfter),
            lenderSharesInCompoundYieldAfter.sub(lenderSharesInCompoundYieldBefore),
            0
        );

        console.log({
            creditLineAllowanceBefore: creditLineAllowanceBefore.toString(),
            creditLineAllowanceAfter: creditLineAllowanceAfter.toString(),
        });
    });

    it('Repay total amounts from savings account with shares being deducted from 2 strategies', async () => {
        // let borrowDecimals = await BorrowAsset.decimals();
        let borrowDecimals = BigNumber.from(18);
        let amountToRepay = BigNumber.from(120).mul(BigNumber.from(10).pow(borrowDecimals)); // 120 units of borrow tokens
        await BorrowAsset.connect(borrower).approve(env.yields.noYield.address, amountToRepay.div(2));
        await BorrowAsset.connect(borrower).approve(env.yields.compoundYield.address, amountToRepay.div(2));
        await savingsAccount
            .connect(borrower)
            .deposit(amountToRepay.div(2), BorrowAsset.address, env.yields.noYield.address, borrower.address, {
                value: ethers.utils.parseEther('60'),
            });

        await savingsAccount
            .connect(borrower)
            .deposit(amountToRepay.div(2), BorrowAsset.address, env.yields.compoundYield.address, borrower.address, {
                value: ethers.utils.parseEther('60'),
            });
        await savingsAccount.connect(borrower).approve(amountToRepay, BorrowAsset.address, creditLine.address);

        let creditLineAllowanceBefore = await savingsAccount
            .connect(borrower)
            .allowance(lender.address, BorrowAsset.address, creditLine.address);

        let borrowerSharesInNoYieldBefore = await savingsAccount
            .connect(borrower)
            .balanceInShares(borrower.address, BorrowAsset.address, env.yields.noYield.address);
        let lenderSharesInNoYieldBefore = await savingsAccount
            .connect(borrower)
            .balanceInShares(lender.address, BorrowAsset.address, env.yields.noYield.address);

        let borrowerSharesInNoCompoundYieldBefore = await savingsAccount
            .connect(borrower)
            .balanceInShares(borrower.address, BorrowAsset.address, env.yields.compoundYield.address);
        let lenderSharesInCompoundYieldBefore = await savingsAccount
            .connect(borrower)
            .balanceInShares(lender.address, BorrowAsset.address, env.yields.compoundYield.address);

        await creditLine.connect(borrower).repay(creditLineNumber, amountToRepay, true);
        let borrowerSharesInNoYieldAfter = await savingsAccount
            .connect(borrower)
            .balanceInShares(borrower.address, BorrowAsset.address, env.yields.noYield.address);
        let lenderSharesInNoYieldAfter = await savingsAccount
            .connect(borrower)
            .balanceInShares(lender.address, BorrowAsset.address, env.yields.noYield.address);

        let borrowerSharesInCompoundYieldAfter = await savingsAccount
            .connect(borrower)
            .balanceInShares(borrower.address, BorrowAsset.address, env.yields.compoundYield.address);
        let lenderSharesInCompoundYieldAfter = await savingsAccount
            .connect(borrower)
            .balanceInShares(lender.address, BorrowAsset.address, env.yields.compoundYield.address);

        let creditLineAllowanceAfter = await savingsAccount
            .connect(borrower)
            .allowance(lender.address, BorrowAsset.address, creditLine.address);

        expectApproxEqual(
            borrowerSharesInNoYieldBefore.sub(borrowerSharesInNoYieldAfter),
            lenderSharesInNoYieldAfter.sub(lenderSharesInNoYieldBefore),
            0
        );
        expectApproxEqual(
            borrowerSharesInNoCompoundYieldBefore.sub(borrowerSharesInCompoundYieldAfter),
            lenderSharesInCompoundYieldAfter.sub(lenderSharesInCompoundYieldBefore),
            0
        );

        console.log({
            creditLineAllowanceBefore: creditLineAllowanceBefore.toString(),
            creditLineAllowanceAfter: creditLineAllowanceAfter.toString(),
        });
    });
});

describe('Restore Snapshot', async () => {
    it('Trying to restore Snapshot', async () => {
        await network.provider.request({
            method: 'evm_revert',
            params: [snapshotId],
        });
    });
});
