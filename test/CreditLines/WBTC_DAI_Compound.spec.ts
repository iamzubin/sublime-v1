import { ethers, network } from 'hardhat';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { BigNumber, BigNumberish } from '@ethersproject/bignumber';
import { expect } from 'chai';

import {
    aaveYieldParams,
    depositValueToTest,
    zeroAddress,
    Binance7 as binance7,
    WhaleAccount as whaleAccount,
    DAI_Yearn_Protocol_Address,
    LINK_Yearn_Protocol_Address,
    testPoolFactoryParams,
    createPoolParams,
    ChainLinkAggregators,
    OperationalAmounts,
    extensionParams,
    WBTCWhale as wbtcwhale,
} from '../../utils/constants';
import DeployHelper from '../../utils/deploys';

import { SavingsAccount } from '../../typechain/SavingsAccount';
import { StrategyRegistry } from '../../typechain/StrategyRegistry';

import { getPoolAddress, getRandomFromArray, incrementChain } from '../../utils/helpers';

import { Address } from 'hardhat-deploy/dist/types';
import { AaveYield } from '../../typechain/AaveYield';
import { YearnYield } from '../../typechain/YearnYield';
import { CompoundYield } from '../../typechain/CompoundYield';
import { Pool } from '../../typechain/Pool';
import { Verification } from '../../typechain/Verification';
import { PoolFactory } from '../../typechain/PoolFactory';
import { ERC20 } from '../../typechain/ERC20';
import { PriceOracle } from '../../typechain/PriceOracle';
import { Extension } from '../../typechain/Extension';
import { CreditLine } from '../../typechain/CreditLine';

import { Contracts } from '../../existingContracts/compound.json';
import { sha256 } from '@ethersproject/sha2';
import { PoolToken } from '../../typechain/PoolToken';
import { Repayments } from '../../typechain/Repayments';
import { ContractTransaction } from '@ethersproject/contracts';
import { getContractAddress } from '@ethersproject/address';
import { BytesLike } from '@ethersproject/bytes';
import { AdminVerifier } from '@typechain/AdminVerifier';
import { NoYield } from '../../typechain/NoYield';

describe('WBTC-DAI Credit Lines', async () => {
    let savingsAccount: SavingsAccount;
    let strategyRegistry: StrategyRegistry;

    let mockCreditLines: SignerWithAddress;
    let proxyAdmin: SignerWithAddress;
    let admin: SignerWithAddress;
    let borrower: SignerWithAddress;
    let lender: SignerWithAddress;
    let protocolFeeCollector: SignerWithAddress;
    let extraAccount: SignerWithAddress;

    let aaveYield: AaveYield;
    let yearnYield: YearnYield;
    let compoundYield: CompoundYield;
    let noYield: NoYield;

    let BatTokenContract: ERC20;
    let LinkTokenContract: ERC20;
    let DaiTokenContract: ERC20;

    let verification: Verification;
    let adminVerifier: AdminVerifier;
    let priceOracle: PriceOracle;

    let Binance7: any;
    let WhaleAccount: any;

    let creditLine: CreditLine;
    let poolFactory: PoolFactory;
    let extenstion: Extension;

    let WBTCTokenContract: ERC20;
    let WBTCWhale: any;

    let borrowerCreditLine: BytesLike;
    let lenderCreditLine: BytesLike;

    let extraAccounts: SignerWithAddress[];

    before(async () => {
        [proxyAdmin, admin, mockCreditLines, borrower, lender, protocolFeeCollector] = await ethers.getSigners();
        extraAccounts = await (await ethers.getSigners()).slice(-100);

        let deployHelper: DeployHelper = new DeployHelper(proxyAdmin);
        savingsAccount = await deployHelper.core.deploySavingsAccount();
        strategyRegistry = await deployHelper.core.deployStrategyRegistry();

        //initialize
        savingsAccount.initialize(admin.address, strategyRegistry.address, mockCreditLines.address);
        strategyRegistry.initialize(admin.address, 10);

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

        aaveYield = await deployHelper.core.deployAaveYield();
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

        compoundYield = await deployHelper.core.deployCompoundYield();
        await compoundYield.initialize(admin.address, savingsAccount.address);
        await strategyRegistry.connect(admin).addStrategy(compoundYield.address);
        await compoundYield.connect(admin).updateProtocolAddresses(Contracts.DAI, Contracts.cDAI);
        await compoundYield.connect(admin).updateProtocolAddresses(Contracts.WBTC, Contracts.cWBTC2);

        noYield = await deployHelper.core.deployNoYield();
        await noYield.initialize(admin.address, savingsAccount.address);
        await strategyRegistry.connect(admin).addStrategy(noYield.address);

        verification = await deployHelper.helper.deployVerification();
        await verification.connect(admin).initialize(admin.address);
        adminVerifier = await deployHelper.helper.deployAdminVerifier();
        await verification.connect(admin).addVerifier(adminVerifier.address);
        await adminVerifier.connect(admin).initialize(admin.address, verification.address);
        await adminVerifier.connect(admin).registerUser(borrower.address, sha256(Buffer.from('Borrower')), true);

        priceOracle = await deployHelper.helper.deployPriceOracle();
        await priceOracle.connect(admin).initialize(admin.address);
        await priceOracle.connect(admin).setChainlinkFeedAddress(Contracts.LINK, ChainLinkAggregators['LINK/USD']);
        await priceOracle.connect(admin).setChainlinkFeedAddress(Contracts.DAI, ChainLinkAggregators['DAI/USD']);
        await priceOracle.connect(admin).setChainlinkFeedAddress(Contracts.WBTC, ChainLinkAggregators['BTC/USD']);

        deployHelper = new DeployHelper(proxyAdmin);
        creditLine = await deployHelper.core.deployCreditLines();
        poolFactory = await deployHelper.pool.deployPoolFactory();
        extenstion = await deployHelper.pool.deployExtenstion();

        await extenstion.connect(admin).initialize(poolFactory.address, extensionParams.votingPassRatio);
        await savingsAccount.connect(admin).updateCreditLine(creditLine.address);

        let {
            _collectionPeriod,
            _marginCallDuration,
            _collateralVolatilityThreshold,
            _gracePeriodPenaltyFraction,
            _liquidatorRewardFraction,
            _matchCollateralRatioInterval,
            _poolInitFuncSelector,
            _poolTokenInitFuncSelector,
            _poolCancelPenalityFraction,
            _protocolFeeFraction,
        } = testPoolFactoryParams;

        await poolFactory
            .connect(admin)
            .initialize(
                admin.address,
                _collectionPeriod,
                _matchCollateralRatioInterval,
                _marginCallDuration,
                _gracePeriodPenaltyFraction,
                _poolInitFuncSelector,
                _poolTokenInitFuncSelector,
                _liquidatorRewardFraction,
                _poolCancelPenalityFraction,
                _protocolFeeFraction,
                protocolFeeCollector.address
            );

        const poolImpl = await deployHelper.pool.deployPool();
        const poolTokenImpl = await deployHelper.pool.deployPoolToken();
        const repaymentImpl = await deployHelper.pool.deployRepayments();
        await poolFactory
            .connect(admin)
            .setImplementations(
                poolImpl.address,
                repaymentImpl.address,
                poolTokenImpl.address,
                verification.address,
                strategyRegistry.address,
                priceOracle.address,
                savingsAccount.address,
                extenstion.address
            );

        await creditLine
            .connect(admin)
            .initialize(
                compoundYield.address,
                priceOracle.address,
                savingsAccount.address,
                strategyRegistry.address,
                admin.address,
                _protocolFeeFraction,
                protocolFeeCollector.address
            );
    });

    describe('Create Credit Lines - Lender', async () => {
        let borrowLimit: BigNumber = BigNumber.from('10').mul('1000000000000000000'); // 10e18
        beforeEach(async () => {
            let _borrower: string = borrower.address;
            let _liquidationThreshold: BigNumberish = BigNumber.from(100);
            let _borrowRate: BigNumberish = BigNumber.from(1).mul(BigNumber.from('10').pow(28));
            let _autoLiquidation: boolean = true;
            let _collateralRatio: BigNumberish = BigNumber.from(200);
            let _borrowAsset: string = Contracts.DAI;
            let _collateralAsset: string = Contracts.WBTC;

            let values = await creditLine
                .connect(lender)
                .callStatic.requestCreditLineToBorrower(
                    _borrower,
                    borrowLimit,
                    _liquidationThreshold,
                    _borrowRate,
                    _autoLiquidation,
                    _collateralRatio,
                    _borrowAsset,
                    _collateralAsset
                );

            await expect(
                creditLine
                    .connect(lender)
                    .requestCreditLineToBorrower(
                        _borrower,
                        borrowLimit,
                        _liquidationThreshold,
                        _borrowRate,
                        _autoLiquidation,
                        _collateralRatio,
                        _borrowAsset,
                        _collateralAsset
                    )
            )
                .to.emit(creditLine, 'CreditLineRequestedToBorrower')
                .withArgs(values, lender.address, borrower.address);

            lenderCreditLine = values;
        });

        it('Check Credit Line Info', async () => {
            let creditLineInfo = await creditLine.creditLineInfo(lenderCreditLine);
            print(creditLineInfo);
        });

        it('Borrow From Credit Line only borrower', async () => {
            let lenderAmount = BigNumber.from(10).pow(20); // 100 DAI
            let borrowerCollateral = BigNumber.from(10).pow(8); // 1WBTC
            let borrowAmount = BigNumber.from(10).pow(19); //10 DAI

            let unlimited = BigNumber.from(10).pow(60);

            await creditLine.connect(borrower).acceptCreditLineBorrower(lenderCreditLine);

            await DaiTokenContract.connect(admin).transfer(lender.address, lenderAmount);
            await DaiTokenContract.connect(lender).approve(compoundYield.address, lenderAmount);

            await WBTCTokenContract.connect(admin).transfer(borrower.address, borrowerCollateral);
            await WBTCTokenContract.connect(borrower).approve(creditLine.address, borrowerCollateral);

            await creditLine.connect(borrower).depositCollateral(Contracts.WBTC, borrowerCollateral, lenderCreditLine, false);

            await savingsAccount.connect(lender).depositTo(lenderAmount, DaiTokenContract.address, compoundYield.address, lender.address);
            await savingsAccount.connect(lender).approve(DaiTokenContract.address, creditLine.address, unlimited);

            await creditLine.connect(borrower).borrowFromCreditLine(borrowAmount, lenderCreditLine);
        });
    });
});

function print(data: any) {
    console.log(JSON.stringify(data, null, 4));
}
