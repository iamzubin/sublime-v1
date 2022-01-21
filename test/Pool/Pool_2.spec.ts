import hre from 'hardhat';
const { ethers, network } = hre;
import { BigNumber, BigNumberish } from '@ethersproject/bignumber';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';

import { expect } from 'chai';
import { blockTravel, timeTravel } from '../../utils/time';

import {
    aaveYieldParams,
    depositValueToTest,
    zeroAddress,
    Binance7 as binance7,
    WhaleAccount as whaleAccount,
    WBTCWhale as wbtcwhale,
    DAI_Yearn_Protocol_Address,
    testPoolFactoryParams,
    createPoolParams,
    ChainLinkAggregators,
    OperationalAmounts,
    extensionParams,
    repaymentParams,
    verificationParams,
} from '../../utils/constants';
import DeployHelper from '../../utils/deploys';

import { SavingsAccount } from '@typechain/SavingsAccount';
import { StrategyRegistry } from '@typechain/StrategyRegistry';

import { getPoolAddress, getRandomFromArray, incrementChain, expectApproxEqual } from '../../utils/helpers';

import { Address } from 'hardhat-deploy/dist/types';
import { AaveYield } from '@typechain/AaveYield';
import { YearnYield } from '@typechain/YearnYield';
import { CompoundYield } from '@typechain/CompoundYield';
import { Pool } from '@typechain/Pool';
import { Verification } from '@typechain/Verification';
import { PoolFactory } from '@typechain/PoolFactory';
import { ERC20 } from '@typechain/ERC20';
import { PriceOracle } from '@typechain/PriceOracle';
import { Extension } from '@typechain/Extension';

import { Contracts } from '../../existingContracts/compound.json';
import { sha256 } from '@ethersproject/sha2';
import { Repayments } from '@typechain/Repayments';

import { getContractAddress } from '@ethersproject/address';

import { SublimeProxy } from '@typechain/SublimeProxy';
import { IYield } from '@typechain/IYield';
import { AdminVerifier } from '@typechain/AdminVerifier';
import { ERC20Detailed } from '@typechain/ERC20Detailed';
import { NoYield } from '@typechain/NoYield';
import { getPoolInitSigHash } from '../../utils/createEnv/poolLogic';

describe('Pool Lending', async () => {
    let savingsAccount: SavingsAccount;
    let savingsAccountLogic: SavingsAccount;

    let strategyRegistry: StrategyRegistry;
    let strategyRegistryLogic: StrategyRegistry;

    let mockCreditLines: SignerWithAddress;
    let proxyAdmin: SignerWithAddress;
    let admin: SignerWithAddress;
    let borrower: SignerWithAddress;
    let lender: SignerWithAddress;
    let protocolFeeCollector: SignerWithAddress;
    let extraLenders: SignerWithAddress[];

    let aaveYield: AaveYield;
    let aaveYieldLogic: AaveYield;

    let yearnYield: YearnYield;
    let yearnYieldLogic: YearnYield;

    let compoundYield: CompoundYield;
    let compoundYieldLogic: CompoundYield;

    let noYield: NoYield;
    let noYieldLogic: NoYield;

    let BatTokenContract: ERC20;
    let LinkTokenContract: ERC20;
    let DaiTokenContract: ERC20;
    let WBTCTokenContract: ERC20;

    let verificationLogic: Verification;
    let verification: Verification;
    let adminVerifierLogic: AdminVerifier;
    let adminVerifier: AdminVerifier;

    let priceOracleLogic: PriceOracle;
    let priceOracle: PriceOracle;

    let Binance7: any;
    let WhaleAccount: any;
    let WBTCWhale: any;

    let extenstionLogic: Extension;
    let extenstion: Extension;

    let poolLogic: Pool;

    let repaymentLogic: Repayments;
    let repayments: Repayments;

    let poolFactoryLogic: PoolFactory;
    let poolFactory: PoolFactory;

    let pool: Pool;

    before(async () => {
        [proxyAdmin, admin, mockCreditLines, borrower, lender, protocolFeeCollector] = await ethers.getSigners();
        extraLenders = await (await ethers.getSigners()).slice(-100);

        let deployHelper: DeployHelper = new DeployHelper(proxyAdmin);
        savingsAccountLogic = await deployHelper.core.deploySavingsAccount();
        let savingsAccountProxy: SublimeProxy = await deployHelper.helper.deploySublimeProxy(
            savingsAccountLogic.address,
            proxyAdmin.address
        );
        savingsAccount = await deployHelper.core.getSavingsAccount(savingsAccountProxy.address);

        strategyRegistryLogic = await deployHelper.core.deployStrategyRegistry();
        let strategyRegistryProxy: SublimeProxy = await deployHelper.helper.deploySublimeProxy(
            strategyRegistryLogic.address,
            proxyAdmin.address
        );
        strategyRegistry = await deployHelper.core.getStrategyRegistry(strategyRegistryProxy.address);

        //initialize
        await savingsAccount.connect(admin).initialize(admin.address, strategyRegistry.address, mockCreditLines.address);
        await strategyRegistry.connect(admin).initialize(admin.address, 10);

        await network.provider.request({
            method: 'hardhat_impersonateAccount',
            params: [binance7],
        });

        await network.provider.request({
            method: 'hardhat_impersonateAccount',
            params: [whaleAccount],
        });

        await network.provider.request({
            method: 'hardhat_impersonateAccount',
            params: [wbtcwhale],
        });

        await admin.sendTransaction({
            to: whaleAccount,
            value: ethers.utils.parseEther('100'),
        });

        await admin.sendTransaction({
            to: wbtcwhale,
            value: ethers.utils.parseEther('100'),
        });

        Binance7 = await ethers.provider.getSigner(binance7);
        WhaleAccount = await ethers.provider.getSigner(whaleAccount);
        WBTCWhale = await ethers.provider.getSigner(wbtcwhale);

        BatTokenContract = await deployHelper.mock.getMockERC20(Contracts.BAT);
        await BatTokenContract.connect(Binance7).transfer(admin.address, BigNumber.from('10').pow(23)); // 10,000 BAT tokens

        LinkTokenContract = await deployHelper.mock.getMockERC20(Contracts.LINK);
        await LinkTokenContract.connect(Binance7).transfer(admin.address, BigNumber.from('10').pow(23)); // 10,000 LINK tokens

        DaiTokenContract = await deployHelper.mock.getMockERC20(Contracts.DAI);
        await DaiTokenContract.connect(WhaleAccount).transfer(admin.address, BigNumber.from('10').pow(23)); // 10,000 DAI

        WBTCTokenContract = await deployHelper.mock.getMockERC20(Contracts.WBTC);
        await WBTCTokenContract.connect(WBTCWhale).transfer(admin.address, BigNumber.from('10').pow(10)); // 100 BTC

        aaveYieldLogic = await deployHelper.core.deployAaveYield();
        let aaveYieldProxy = await deployHelper.helper.deploySublimeProxy(aaveYieldLogic.address, proxyAdmin.address);
        aaveYield = await deployHelper.core.getAaveYield(aaveYieldProxy.address);

        await aaveYield
            .connect(admin)
            .initialize(
                admin.address,
                savingsAccount.address,
                aaveYieldParams._wethGateway,
                aaveYieldParams._protocolDataProvider,
                aaveYieldParams._lendingPoolAddressesProvider
            );

        await strategyRegistry.connect(admin).addStrategy(aaveYield.address);

        yearnYieldLogic = await deployHelper.core.deployYearnYield();
        let yearnYieldProxy = await deployHelper.helper.deploySublimeProxy(yearnYieldLogic.address, proxyAdmin.address);
        yearnYield = await deployHelper.core.getYearnYield(yearnYieldProxy.address);

        await yearnYield.connect(admin).initialize(admin.address, savingsAccount.address);
        await strategyRegistry.connect(admin).addStrategy(yearnYield.address);
        await yearnYield.connect(admin).updateProtocolAddresses(DaiTokenContract.address, DAI_Yearn_Protocol_Address);

        compoundYieldLogic = await deployHelper.core.deployCompoundYield();
        let compoundYieldProxy = await deployHelper.helper.deploySublimeProxy(compoundYieldLogic.address, proxyAdmin.address);
        compoundYield = await deployHelper.core.getCompoundYield(compoundYieldProxy.address);

        await compoundYield.connect(admin).initialize(admin.address, savingsAccount.address);
        await strategyRegistry.connect(admin).addStrategy(compoundYield.address);
        await compoundYield.connect(admin).updateProtocolAddresses(Contracts.DAI, Contracts.cDAI);
        await compoundYield.connect(admin).updateProtocolAddresses(Contracts.WBTC, Contracts.cWBTC2);

        noYieldLogic = await deployHelper.core.deployNoYield();
        let noYieldProxy = await deployHelper.helper.deploySublimeProxy(noYieldLogic.address, proxyAdmin.address);
        noYield = await deployHelper.core.getNoYield(noYieldProxy.address);
        await noYield.connect(admin).initialize(admin.address, savingsAccount.address);

        await strategyRegistry.connect(admin).addStrategy(noYield.address);

        verificationLogic = await deployHelper.helper.deployVerification();
        let verificationProxy = await deployHelper.helper.deploySublimeProxy(verificationLogic.address, proxyAdmin.address);
        verification = await deployHelper.helper.getVerification(verificationProxy.address);
        adminVerifierLogic = await deployHelper.helper.deployAdminVerifier();
        let adminVerificationProxy = await deployHelper.helper.deploySublimeProxy(adminVerifierLogic.address, proxyAdmin.address);
        adminVerifier = await deployHelper.helper.getAdminVerifier(adminVerificationProxy.address);
        await verification.connect(admin).initialize(admin.address, verificationParams.activationDelay);
        await adminVerifier.connect(admin).initialize(admin.address, verification.address);
        await verification.connect(admin).addVerifier(adminVerifier.address);
        await adminVerifier.connect(admin).registerUser(borrower.address, sha256(Buffer.from('Borrower')), true);

        priceOracleLogic = await deployHelper.helper.deployPriceOracle();
        let priceOracleProxy = await deployHelper.helper.deploySublimeProxy(priceOracleLogic.address, proxyAdmin.address);
        priceOracle = await deployHelper.helper.getPriceOracle(priceOracleProxy.address);
        await priceOracle.connect(admin).initialize(admin.address);

        await priceOracle.connect(admin).setChainlinkFeedAddress(Contracts.LINK, ChainLinkAggregators['LINK/USD']);
        await priceOracle.connect(admin).setChainlinkFeedAddress(Contracts.DAI, ChainLinkAggregators['DAI/USD']);
        await priceOracle.connect(admin).setChainlinkFeedAddress(Contracts.WBTC, ChainLinkAggregators['BTC/USD']);

        poolFactoryLogic = await deployHelper.pool.deployPoolFactory();
        let poolFactoryProxy = await deployHelper.helper.deploySublimeProxy(poolFactoryLogic.address, proxyAdmin.address);
        poolFactory = await deployHelper.pool.getPoolFactory(poolFactoryProxy.address);

        extenstionLogic = await deployHelper.pool.deployExtenstion();
        let extenstionProxy = await deployHelper.helper.deploySublimeProxy(extenstionLogic.address, proxyAdmin.address);
        extenstion = await deployHelper.pool.getExtension(extenstionProxy.address);
        await extenstion.connect(admin).initialize(poolFactory.address, extensionParams.votingPassRatio);

        repaymentLogic = await deployHelper.pool.deployRepayments();
        let repaymentProxy = await deployHelper.helper.deploySublimeProxy(repaymentLogic.address, proxyAdmin.address);
        repayments = await deployHelper.pool.getRepayments(repaymentProxy.address);
        await repayments
            .connect(admin)
            .initialize(poolFactory.address, repaymentParams.gracePenalityRate, repaymentParams.gracePeriodFraction);

        let {
            _collectionPeriod,
            _marginCallDuration,
            _minborrowFraction,
            _gracePeriodPenaltyFraction,
            _liquidatorRewardFraction,
            _loanWithdrawalDuration,
            _poolCancelPenalityFraction,
            _protocolFeeFraction,
        } = testPoolFactoryParams;

        await poolFactory
            .connect(admin)
            .initialize(
                admin.address,
                _collectionPeriod,
                _loanWithdrawalDuration,
                _marginCallDuration,
                getPoolInitSigHash(),
                _liquidatorRewardFraction,
                _poolCancelPenalityFraction,
                _minborrowFraction,
                _protocolFeeFraction,
                protocolFeeCollector.address,
                noYield.address
            );

        poolLogic = await deployHelper.pool.deployPool();

        await poolFactory.connect(admin).updateSupportedCollateralTokens(Contracts.DAI, true);
        await poolFactory.connect(admin).updateSupportedCollateralTokens(Contracts.LINK, true);
        await poolFactory.connect(admin).updateSupportedCollateralTokens(Contracts.WBTC, true);
        await poolFactory.connect(admin).updateSupportedCollateralTokens(zeroAddress, true);

        await poolFactory.connect(admin).updateSupportedBorrowTokens(Contracts.DAI, true);
        await poolFactory.connect(admin).updateSupportedBorrowTokens(Contracts.LINK, true);
        await poolFactory.connect(admin).updateSupportedBorrowTokens(Contracts.WBTC, true);
        await poolFactory.connect(admin).updateSupportedBorrowTokens(zeroAddress, true);

        await poolFactory
            .connect(admin)
            .setImplementations(
                poolLogic.address,
                repayments.address,
                verification.address,
                strategyRegistry.address,
                priceOracle.address,
                savingsAccount.address,
                extenstion.address
            );
    });

    async function createPool() {
        let deployHelper = new DeployHelper(borrower);
        let collateralToken: ERC20 = await deployHelper.mock.getMockERC20(Contracts.WBTC);
        let iyield: IYield = await deployHelper.mock.getYield(compoundYield.address);

        let salt = sha256(Buffer.from(`borrower-${new Date().valueOf()}`));
        // let salt = sha256(Buffer.from(`borrower}`));

        let generatedPoolAddress: Address = await getPoolAddress(
            borrower.address,
            Contracts.DAI,
            Contracts.WBTC,
            iyield.address,
            poolFactory.address,
            salt,
            poolLogic.address,
            false,
            { _collateralAmount: createPoolParams._collateralAmountForWBTC }
        );

        let {
            _poolSize,
            _collateralRatio,
            _borrowRate,
            _repaymentInterval,
            _noOfRepaymentIntervals,
            _collateralAmountForWBTC: _collateralAmount,
        } = createPoolParams;

        await collateralToken.connect(admin).transfer(borrower.address, _collateralAmount.mul(2)); // Transfer quantity to borrower
        await collateralToken.connect(borrower).approve(generatedPoolAddress, _collateralAmount.mul(2));

        await expect(
            poolFactory
                .connect(borrower)
                .createPool(
                    _poolSize,
                    _borrowRate,
                    Contracts.DAI,
                    Contracts.WBTC,
                    _collateralRatio,
                    _repaymentInterval,
                    _noOfRepaymentIntervals,
                    iyield.address,
                    _collateralAmount,
                    false,
                    salt,
                    adminVerifier.address,
                    zeroAddress
                )
        )
            .to.emit(poolFactory, 'PoolCreated')
            .withArgs(generatedPoolAddress, borrower.address);

        pool = await deployHelper.pool.getPool(generatedPoolAddress);
        await pool.connect(borrower).depositCollateral(_collateralAmount, false);
    }

    describe("Lend", async function() {
        before(async function() {
            await createPool();
        });
        it("Test Lending", async function() {
            await DaiTokenContract.connect(admin).transfer(lender.address, OperationalAmounts._amountLent);
            await DaiTokenContract.connect(lender).approve(pool.address, OperationalAmounts._amountLent);
            await expect(pool.connect(lender).lend(lender.address, OperationalAmounts._amountLent, false))
                .to.emit(pool, 'LiquiditySupplied')
                .withArgs(OperationalAmounts._amountLent, lender.address);
        });

        it("Lender should not be able to withdraw the tokens lent in collection period", async function() {
            await expect(pool.connect(lender).withdrawLiquidity())
                    .to.be.revertedWith('WL1');
        })
    });
});
