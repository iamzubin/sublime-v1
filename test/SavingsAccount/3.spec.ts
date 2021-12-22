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
    ETH_Yearn_Protocol_Address,
} from '../../utils/constants';
import DeployHelper from '../../utils/deploys';

import { SavingsAccount } from '../../typechain/SavingsAccount';
import { StrategyRegistry } from '../../typechain/StrategyRegistry';
import { expectApproxEqual, getRandomFromArray, incrementChain } from '../../utils/helpers';
import { Address } from 'hardhat-deploy/dist/types';
import { AaveYield } from '../../typechain/AaveYield';
import { YearnYield } from '../../typechain/YearnYield';
import { CompoundYield } from '../../typechain/CompoundYield';
import { ERC20 } from '../../typechain/ERC20';

import { Contracts } from '../../existingContracts/compound.json';
import { NoYield } from '@typechain/NoYield';

describe('Switch Strategy', async () => {
    let savingsAccount: SavingsAccount;
    let strategyRegistry: StrategyRegistry;

    let mockCreditLinesAddress: SignerWithAddress;
    let proxyAdmin: SignerWithAddress;
    let admin: SignerWithAddress;

    let BatTokenContract: ERC20;
    let LinkTokenContract: ERC20;
    let DaiTokenContract: ERC20;

    let Binance7: any;
    let WhaleAccount: any;
    let noYield: NoYield;
    let compoundYield: CompoundYield;
    let yearnYield: YearnYield;

    before(async () => {
        [proxyAdmin, admin, mockCreditLinesAddress] = await ethers.getSigners();
        const deployHelper: DeployHelper = new DeployHelper(proxyAdmin);
        savingsAccount = await deployHelper.core.deploySavingsAccount();
        strategyRegistry = await deployHelper.core.deployStrategyRegistry();

        await network.provider.request({
            method: 'hardhat_impersonateAccount',
            params: [binance7],
        });

        await network.provider.request({
            method: 'hardhat_impersonateAccount',
            params: [whaleAccount],
        });

        await admin.sendTransaction({
            to: whaleAccount,
            value: ethers.utils.parseEther('100'),
        });

        Binance7 = await ethers.provider.getSigner(binance7);
        WhaleAccount = await ethers.provider.getSigner(whaleAccount);

        BatTokenContract = await deployHelper.mock.getMockERC20(Contracts.BAT);
        await BatTokenContract.connect(Binance7).transfer(admin.address, BigNumber.from('10').pow(23)); // 10,000 BAT tokens

        LinkTokenContract = await deployHelper.mock.getMockERC20(Contracts.LINK);
        await LinkTokenContract.connect(Binance7).transfer(admin.address, BigNumber.from('10').pow(23)); // 10,000 LINK tokens

        DaiTokenContract = await deployHelper.mock.getMockERC20(Contracts.DAI);
        await DaiTokenContract.connect(WhaleAccount).transfer(admin.address, BigNumber.from('10').pow(23)); // 10,000 DAI

        //initialize
        await savingsAccount.initialize(admin.address, strategyRegistry.address, mockCreditLinesAddress.address);
        await strategyRegistry.initialize(admin.address, 1000);

        noYield = await deployHelper.core.deployNoYield();
        await noYield.connect(admin).initialize(admin.address, savingsAccount.address);
        await strategyRegistry.connect(admin).addStrategy(noYield.address);

        yearnYield = await deployHelper.core.deployYearnYield();
        await yearnYield.initialize(admin.address, savingsAccount.address);
        await strategyRegistry.connect(admin).addStrategy(yearnYield.address);
        await yearnYield.connect(admin).updateProtocolAddresses(DaiTokenContract.address, DAI_Yearn_Protocol_Address);
        await yearnYield.connect(admin).updateProtocolAddresses(zeroAddress, ETH_Yearn_Protocol_Address);

        compoundYield = await deployHelper.core.deployCompoundYield();
        await compoundYield.initialize(admin.address, savingsAccount.address);
        await strategyRegistry.connect(admin).addStrategy(compoundYield.address);
        await compoundYield.connect(admin).updateProtocolAddresses(Contracts.DAI, Contracts.cDAI);
        await compoundYield.connect(admin).updateProtocolAddresses(zeroAddress, Contracts.cETH);

        await network.provider.request({
            method: 'hardhat_impersonateAccount',
            params: [binance7],
        });

        await network.provider.request({
            method: 'hardhat_impersonateAccount',
            params: [whaleAccount],
        });

        await admin.sendTransaction({
            to: whaleAccount,
            value: ethers.utils.parseEther('100'),
        });

        Binance7 = await ethers.provider.getSigner(binance7);
        WhaleAccount = await ethers.provider.getSigner(whaleAccount);

        BatTokenContract = await deployHelper.mock.getMockERC20(Contracts.BAT);
        await BatTokenContract.connect(Binance7).transfer(admin.address, BigNumber.from('10').pow(23)); // 10,000 BAT tokens

        LinkTokenContract = await deployHelper.mock.getMockERC20(Contracts.LINK);
        await LinkTokenContract.connect(Binance7).transfer(admin.address, BigNumber.from('10').pow(23)); // 10,000 LINK tokens

        DaiTokenContract = await deployHelper.mock.getMockERC20(Contracts.DAI);
        await DaiTokenContract.connect(WhaleAccount).transfer(admin.address, BigNumber.from('10').pow(23)); // 10,000 DAI
    });

    describe('When Tokens is ETH', async () => {
        let userAccount: SignerWithAddress;
        let some_dai = '1000000100000000';

        before(async () => {
            // deposit ETH to no yield
            [, , , , , userAccount] = await ethers.getSigners();
            await savingsAccount.connect(userAccount).deposit(depositValueToTest, zeroAddress, noYield.address, userAccount.address, {
                value: depositValueToTest,
            });

            await DaiTokenContract.connect(admin).transfer(userAccount.address, some_dai); // some dai
            await DaiTokenContract.connect(userAccount).approve(noYield.address, some_dai);
            await savingsAccount.connect(userAccount).deposit(some_dai, DaiTokenContract.address, noYield.address, userAccount.address);
        });

        it('Switch from no yield to compound yield', async () => {
            await expect(
                savingsAccount.connect(userAccount).switchStrategy(depositValueToTest, zeroAddress, noYield.address, compoundYield.address)
            ).to.emit(savingsAccount, 'StrategySwitched');
        });

        it('get total tokens should be approximately same before and after', async () => {
            let totalDaiTokensBefore = await savingsAccount
                .connect(userAccount)
                .callStatic.getTotalTokens(userAccount.address, DaiTokenContract.address);
            await savingsAccount
                .connect(userAccount)
                .switchStrategy(some_dai, DaiTokenContract.address, noYield.address, compoundYield.address);
            let totalDaiTokensAfter = await savingsAccount
                .connect(userAccount)
                .callStatic.getTotalTokens(userAccount.address, DaiTokenContract.address);
            // console.log({totalDaiTokensAfter: totalDaiTokensAfter.toString(), totalDaiTokensBefore: totalDaiTokensBefore.toString()});
            expectApproxEqual(totalDaiTokensBefore, totalDaiTokensAfter, 1000000000000);
        });

        it('Decrease Allowance and check', async () => {
            await savingsAccount
                .connect(userAccount)
                .increaseAllowance('128796238567823684621827', DaiTokenContract.address, admin.address);
            const allowanceBefore = await savingsAccount.allowance(userAccount.address, DaiTokenContract.address, admin.address);
            const toDecrease = '238972';
            await expect(
                savingsAccount.connect(userAccount).decreaseAllowance(toDecrease, DaiTokenContract.address, admin.address)
            ).to.emit(savingsAccount, 'Approved');
            const allowanceAfter = await savingsAccount.allowance(userAccount.address, DaiTokenContract.address, admin.address);
            expect(allowanceAfter).eq(allowanceBefore.sub(toDecrease));
        });

        it('Withdraw All Tokens', async () => {
            await expect(
                savingsAccount.connect(userAccount)['withdrawAll(address,address)'](DaiTokenContract.address, compoundYield.address)
            ).to.emit(savingsAccount, 'Withdrawn');
        });
    });
});
