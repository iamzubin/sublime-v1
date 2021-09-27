import { ethers, network } from 'hardhat';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { BigNumber, BigNumberish } from '@ethersproject/bignumber';
import { expect } from 'chai';

import { aaveYieldParams, depositValueToTest, ETH_Yearn_Protocol_Address } from '../../utils/constants';

import DeployHelper from '../../utils/deploys';
import { SavingsAccount } from '../../typechain/SavingsAccount';
import { StrategyRegistry } from '../../typechain/StrategyRegistry';
import { expectApproxEqual, getRandomFromArray, incrementChain } from '../../utils/helpers';
import { Address } from 'hardhat-deploy/dist/types';

import { AaveYield } from '../../typechain/AaveYield';
import { YearnYield } from '../../typechain/YearnYield';
import { CompoundYield } from '../../typechain/CompoundYield';
import { NoYield } from '../../typechain/NoYield';

import { Contracts } from '../../existingContracts/compound.json';
import { WETH9 } from '../../existingContracts/tokens.json';

import { IWETH9 } from '../../typechain/IWETH9';
import { IyVault } from '../../typechain/IyVault';
import { ERC20 } from '../../typechain/ERC20';

describe('Test Savings Account (with ETH)', async () => {
    let savingsAccount: SavingsAccount;
    let strategyRegistry: StrategyRegistry;

    let mockCreditLinesAddress: SignerWithAddress;
    let proxyAdmin: SignerWithAddress;
    let admin: SignerWithAddress;

    let iweth: IWETH9;
    let noYield: NoYield;

    before(async () => {
        [proxyAdmin, admin, mockCreditLinesAddress] = await ethers.getSigners();
        const deployHelper: DeployHelper = new DeployHelper(proxyAdmin);
        savingsAccount = await deployHelper.core.deploySavingsAccount();
        strategyRegistry = await deployHelper.core.deployStrategyRegistry();

        iweth = await deployHelper.mock.getIWETH9(WETH9);
        //initialize
        noYield = await deployHelper.core.deployNoYield();
        await noYield.connect(admin).initialize(admin.address, savingsAccount.address);

        await savingsAccount.connect(admin).initialize(admin.address, strategyRegistry.address, mockCreditLinesAddress.address);
        await strategyRegistry.connect(admin).initialize(admin.address, 10);
        await strategyRegistry.connect(admin).addStrategy(noYield.address);
    });

    describe('# When NO STRATEGY is preferred', async () => {
        let randomAccount: SignerWithAddress;
        let userAccount: SignerWithAddress;

        beforeEach(async () => {
            randomAccount = getRandomFromArray(await ethers.getSigners());
            userAccount = getRandomFromArray(await ethers.getSigners());

            while ([randomAccount.address].includes(userAccount.address)) {
                userAccount = getRandomFromArray(await ethers.getSigners());
            }
        });

        it('Should successfully deposit into account another account', async () => {
            const balanceLockedBeforeTransaction: BigNumber = await savingsAccount.userLockedBalance(
                randomAccount.address,
                iweth.address,
                noYield.address
            );

            await iweth.connect(userAccount).deposit({ value: depositValueToTest });
            await iweth.connect(userAccount).approve(noYield.address, depositValueToTest);
            await savingsAccount.connect(userAccount).depositTo(depositValueToTest, iweth.address, noYield.address, randomAccount.address);

            const balanceLockedAfterTransaction: BigNumber = await savingsAccount.userLockedBalance(
                randomAccount.address,
                iweth.address,
                noYield.address
            );

            expect(balanceLockedAfterTransaction.sub(balanceLockedBeforeTransaction)).eq(depositValueToTest);
        });

        it('Should successfully deposit into its own accounts', async () => {
            const balanceLockedBeforeTransaction: BigNumber = await savingsAccount.userLockedBalance(
                userAccount.address,
                iweth.address,
                noYield.address
            );

            await iweth.connect(userAccount).deposit({ value: depositValueToTest });
            await iweth.connect(userAccount).approve(noYield.address, depositValueToTest);
            await expect(
                savingsAccount.connect(userAccount).depositTo(depositValueToTest, iweth.address, noYield.address, userAccount.address)
            )
                .to.emit(savingsAccount, 'Deposited')
                .withArgs(userAccount.address, depositValueToTest, iweth.address, noYield.address);

            const balanceLockedAfterTransaction: BigNumber = await savingsAccount.userLockedBalance(
                userAccount.address,
                iweth.address,
                noYield.address
            );

            expect(balanceLockedAfterTransaction.sub(balanceLockedBeforeTransaction)).eq(depositValueToTest);
        });

        async function subject(to: Address, depositValue: BigNumberish): Promise<any> {
            return savingsAccount.connect(userAccount).depositTo(depositValue, iweth.address, noYield.address, to);
        }

        describe('Failed cases', async () => {
            it('Should throw error or revert if receiver address is zero_address', async () => {
                await expect(subject('0x0000000000000000000000000000000000000000', depositValueToTest)).to.be.revertedWith(
                    'SavingsAccount::depositTo receiver address should not be zero address'
                );
            });

            it('should throw error or revert if deposit value is 0', async () => {
                await expect(subject(randomAccount.address, 0)).to.be.revertedWith(
                    'SavingsAccount::_deposit Amount must be greater than zero'
                );
            });
        });
    });

    describe.skip('#When AaveYield is the strategy', async () => {
        let randomAccount: SignerWithAddress;
        let userAccount: SignerWithAddress;
        let withdrawAccount: SignerWithAddress;

        let aaveYield: AaveYield;
        let sharesReceivedWithAave: BigNumberish;

        before(async () => {
            randomAccount = getRandomFromArray(await ethers.getSigners());

            userAccount = getRandomFromArray(await ethers.getSigners());
            while ([randomAccount.address].includes(userAccount.address)) {
                userAccount = getRandomFromArray(await ethers.getSigners());
            }

            withdrawAccount = getRandomFromArray(await ethers.getSigners());
            while ([randomAccount.address, userAccount.address].includes(withdrawAccount.address)) {
                withdrawAccount = getRandomFromArray(await ethers.getSigners());
            }

            const deployHelper: DeployHelper = new DeployHelper(proxyAdmin);
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
        });

        it('Should deposit into another account', async () => {
            const balanceLockedBeforeTransaction: BigNumber = await savingsAccount.userLockedBalance(
                randomAccount.address,
                iweth.address,
                aaveYield.address
            );

            await expect(
                savingsAccount.connect(userAccount).depositTo(depositValueToTest, iweth.address, aaveYield.address, randomAccount.address)
            )
                .to.emit(savingsAccount, 'Deposited')
                .withArgs(randomAccount.address, depositValueToTest, iweth.address, aaveYield.address);

            const balanceLockedAfterTransaction: BigNumber = await savingsAccount.userLockedBalance(
                randomAccount.address,
                iweth.address,
                aaveYield.address
            );

            sharesReceivedWithAave = balanceLockedAfterTransaction.sub(balanceLockedBeforeTransaction);
            expect(sharesReceivedWithAave).eq(depositValueToTest);
        });

        context('Withdraw ETH', async () => {
            it('Withdraw half of shares received to account (withdrawShares = false)', async () => {
                const balanceBeforeWithdraw = await withdrawAccount.getBalance();

                await incrementChain(network, 12000);
                const sharesToWithdraw = BigNumber.from(sharesReceivedWithAave).div(2);
                //gas price is put to zero to check amount received
                await expect(
                    savingsAccount
                        .connect(randomAccount)
                        .withdraw(withdrawAccount.address, sharesToWithdraw, iweth.address, aaveYield.address, false, {})
                )
                    .to.emit(savingsAccount, 'Withdrawn')
                    .withArgs(randomAccount.address, withdrawAccount.address, sharesToWithdraw, iweth.address, aaveYield.address);

                const balanceAfterWithdraw = await withdrawAccount.getBalance();

                const amountReceived: BigNumberish = BigNumber.from(balanceAfterWithdraw).sub(BigNumber.from(balanceBeforeWithdraw));

                expect(sharesToWithdraw).eq(amountReceived);

                const balanceLockedAfterTransaction: BigNumber = await savingsAccount.userLockedBalance(
                    randomAccount.address,
                    iweth.address,
                    aaveYield.address
                );

                expectApproxEqual(
                    balanceLockedAfterTransaction,
                    BigNumber.from(sharesReceivedWithAave).sub(sharesToWithdraw),
                    BigNumber.from(10).pow(16)
                );
            });

            it('Withdraw half of shares received to account (withdrawShares = true)', async () => {
                let aaveEthLiquidityToken: string = await aaveYield.liquidityToken(iweth.address);
                await incrementChain(network, 12000);

                //can be any random number less than the available shares
                const sharesToWithdraw = BigNumber.from(sharesReceivedWithAave).div(2);

                const deployHelper: DeployHelper = new DeployHelper(proxyAdmin);
                const liquidityToken: ERC20 = await deployHelper.mock.getMockERC20(aaveEthLiquidityToken);

                let sharesBefore = await liquidityToken.balanceOf(withdrawAccount.address);

                //gas price is put to zero to check amount received
                await expect(
                    savingsAccount
                        .connect(randomAccount)
                        .withdraw(withdrawAccount.address, sharesToWithdraw, iweth.address, aaveYield.address, true, {})
                )
                    .to.emit(savingsAccount, 'Withdrawn')
                    .withArgs(randomAccount.address, withdrawAccount.address, sharesToWithdraw, aaveEthLiquidityToken, aaveYield.address);

                let sharesAfter = await liquidityToken.balanceOf(withdrawAccount.address);

                expectApproxEqual(sharesAfter.sub(sharesBefore), sharesToWithdraw, BigNumber.from(10).pow(16));
            });
        });
    });

    describe('#When YearnYield is the strategy', async () => {
        let randomAccount: SignerWithAddress;
        let userAccount: SignerWithAddress;
        let withdrawAccount: SignerWithAddress;

        let yearnYield: YearnYield;
        let sharesReceivedWithYearn: BigNumberish;

        before(async () => {
            randomAccount = getRandomFromArray(await ethers.getSigners());

            userAccount = getRandomFromArray(await ethers.getSigners());
            while ([randomAccount.address].includes(userAccount.address)) {
                userAccount = getRandomFromArray(await ethers.getSigners());
            }

            withdrawAccount = getRandomFromArray(await ethers.getSigners());
            while ([randomAccount.address, userAccount.address].includes(withdrawAccount.address)) {
                withdrawAccount = getRandomFromArray(await ethers.getSigners());
            }

            const deployHelper: DeployHelper = new DeployHelper(proxyAdmin);
            yearnYield = await deployHelper.core.deployYearnYield();

            await yearnYield.initialize(admin.address, savingsAccount.address);
            await strategyRegistry.connect(admin).addStrategy(yearnYield.address);

            await yearnYield.connect(admin).updateProtocolAddresses(iweth.address, ETH_Yearn_Protocol_Address);

            await yearnYield.connect(admin).updateIweth9(iweth.address);
        });

        it('Should deposit into another account', async () => {
            const balanceLockedBeforeTransaction: BigNumber = await savingsAccount.userLockedBalance(
                randomAccount.address,
                iweth.address,
                yearnYield.address
            );
            // gas price put to test
            await iweth.connect(userAccount).deposit({ value: depositValueToTest });
            await iweth.connect(userAccount).approve(yearnYield.address, depositValueToTest);

            await expect(
                savingsAccount.connect(userAccount).depositTo(depositValueToTest, iweth.address, yearnYield.address, randomAccount.address)
            )
                .to.emit(savingsAccount, 'Deposited')
                .withArgs(randomAccount.address, depositValueToTest, iweth.address, yearnYield.address);

            const balanceLockedAfterTransaction: BigNumber = await savingsAccount.userLockedBalance(
                randomAccount.address,
                iweth.address,
                yearnYield.address
            );

            sharesReceivedWithYearn = balanceLockedAfterTransaction.sub(balanceLockedBeforeTransaction);
            expect(sharesReceivedWithYearn).lt(depositValueToTest); //@prateek to verify this
        });

        context('Withdraw ETH', async () => {
            it('Withdraw half of shares received to account (withdrawShares = false)', async () => {
                const balanceBeforeWithdraw = await iweth.balanceOf(withdrawAccount.address);

                await incrementChain(network, 12000);
                const sharesToWithdraw = BigNumber.from(sharesReceivedWithYearn).div(2);
                //gas price is put to zero to check amount received
                let yearnEthLiquidityToken: string = await yearnYield.liquidityToken(iweth.address);
                let deployHelper: DeployHelper = new DeployHelper(proxyAdmin);
                let vault: IyVault = await deployHelper.mock.getMockIyVault(yearnEthLiquidityToken);

                // console.log({
                //     expectedEthToBeReleased: expectedEthToBeReleased.toString(),
                //     sharesToWithdraw: sharesToWithdraw.toString(),
                // });

                await expect(
                    savingsAccount
                        .connect(randomAccount)
                        .withdraw(withdrawAccount.address, sharesToWithdraw, iweth.address, yearnYield.address, false)
                )
                    .to.emit(savingsAccount, 'Withdrawn')
                    .withArgs(randomAccount.address, withdrawAccount.address, sharesToWithdraw, iweth.address, yearnYield.address);

                const balanceAfterWithdraw = await iweth.balanceOf(withdrawAccount.address);

                const amountReceived: BigNumberish = BigNumber.from(balanceAfterWithdraw).sub(BigNumber.from(balanceBeforeWithdraw));
                expect(sharesToWithdraw).eq(amountReceived);
            });

            it('Withdraw half of shares received to account (withdrawShares = true)', async () => {
                let yearnEthLiquidityToken: string = await yearnYield.liquidityToken(iweth.address);

                await incrementChain(network, 12000);
                // try to make this random
                const amountToWithdraw = BigNumber.from('100000000000000000').div(2);
                const sharesToWithdraw = BigNumber.from(sharesReceivedWithYearn).div(2);

                const deployHelper: DeployHelper = new DeployHelper(proxyAdmin);
                const liquidityToken: ERC20 = await deployHelper.mock.getMockERC20(yearnEthLiquidityToken);

                let sharesBefore = await liquidityToken.balanceOf(withdrawAccount.address);
                //gas price is put to zero to check amount received

                await expect(
                    savingsAccount
                        .connect(randomAccount)
                        .withdraw(withdrawAccount.address, amountToWithdraw, iweth.address, yearnYield.address, true)
                ).to.emit(savingsAccount, 'Withdrawn');
                // .withArgs(
                //     randomAccount.address,
                //     withdrawAccount.address,
                //     sharesToWithdraw.add(3), //replace with in-range function
                //     yearnEthLiquidityToken,
                //     yearnYield.address
                // );

                // let sharesAfter = await liquidityToken.balanceOf(withdrawAccount.address);
                // expect(sharesAfter.sub(sharesBefore)).eq(sharesToWithdraw);
            });
        });
    });

    describe('#When CompoundYield is the strategy', async () => {
        let randomAccount: SignerWithAddress;
        let userAccount: SignerWithAddress;
        let withdrawAccount: SignerWithAddress;

        let compoundYield: CompoundYield;
        let sharesReceivedWithCompound: BigNumberish;

        before(async () => {
            randomAccount = getRandomFromArray(await ethers.getSigners());

            userAccount = getRandomFromArray(await ethers.getSigners());
            while ([randomAccount.address].includes(userAccount.address)) {
                userAccount = getRandomFromArray(await ethers.getSigners());
            }

            withdrawAccount = getRandomFromArray(await ethers.getSigners());
            while ([randomAccount.address, userAccount.address].includes(withdrawAccount.address)) {
                withdrawAccount = getRandomFromArray(await ethers.getSigners());
            }

            const deployHelper: DeployHelper = new DeployHelper(proxyAdmin);
            compoundYield = await deployHelper.core.deployCompoundYield();

            await compoundYield.initialize(admin.address, savingsAccount.address);
            await strategyRegistry.connect(admin).addStrategy(compoundYield.address);
            await compoundYield.connect(admin).updateProtocolAddresses(iweth.address, Contracts.cETH);
            await compoundYield.connect(admin).updateIweth9(iweth.address);
        });

        it('Should deposit into another account', async () => {
            const balanceLockedBeforeTransaction: BigNumber = await savingsAccount.userLockedBalance(
                randomAccount.address,
                iweth.address,
                compoundYield.address
            );

            await iweth.connect(userAccount).deposit({ value: depositValueToTest });
            await iweth.connect(userAccount).approve(compoundYield.address, depositValueToTest);

            await expect(
                savingsAccount
                    .connect(userAccount)
                    .depositTo(depositValueToTest, iweth.address, compoundYield.address, randomAccount.address)
            )
                .to.emit(savingsAccount, 'Deposited')
                .withArgs(randomAccount.address, depositValueToTest, iweth.address, compoundYield.address);

            const balanceLockedAfterTransaction: BigNumber = await savingsAccount.userLockedBalance(
                randomAccount.address,
                iweth.address,
                compoundYield.address
            );

            sharesReceivedWithCompound = balanceLockedAfterTransaction.sub(balanceLockedBeforeTransaction);
        });

        context('Withdraw ETH', async () => {
            it('Withdraw half of shares received to account (withdrawShares = false)', async () => {
                const balanceBeforeWithdraw = await iweth.balanceOf(withdrawAccount.address);

                await incrementChain(network, 12000);
                const sharesToWithdraw = BigNumber.from(sharesReceivedWithCompound).div(2);

                //gas price is put to zero to check amount received
                await expect(
                    savingsAccount
                        .connect(randomAccount)
                        .withdraw(withdrawAccount.address, sharesToWithdraw, iweth.address, compoundYield.address, false)
                ).to.emit(savingsAccount, 'Withdrawn');

                // const balanceAfterWithdraw = await withdrawAccount.getBalance();

                // const amountReceived: BigNumberish = BigNumber.from(balanceAfterWithdraw).sub(
                //     BigNumber.from(balanceBeforeWithdraw)
                // );

                // expect(amountReceived).gte(depositValueToTest.div(2));
            });

            it('Withdraw half of shares received to account (withdrawShares = true)', async () => {
                let compoundEthLiquidityToken: string = await compoundYield.liquidityToken(iweth.address);

                await incrementChain(network, 12000);
                const sharesToWithdraw = BigNumber.from(sharesReceivedWithCompound).div(2);

                const deployHelper: DeployHelper = new DeployHelper(proxyAdmin);
                const liquidityToken: ERC20 = await deployHelper.mock.getMockERC20(compoundEthLiquidityToken);

                let sharesBefore = await iweth.balanceOf(withdrawAccount.address);
                //gas price is put to zero to check amount received
                await expect(
                    savingsAccount
                        .connect(randomAccount)
                        .withdraw(withdrawAccount.address, sharesToWithdraw, iweth.address, compoundYield.address, true)
                ).to.emit(savingsAccount, 'Withdrawn');
                // .withArgs(
                //     randomAccount.address,
                //     withdrawAccount.address,
                //     sharesToWithdraw,
                //     compoundEthLiquidityToken,
                //     compoundYield.address
                // );
                // let sharesAfter = await liquidityToken.balanceOf(withdrawAccount.address);
                // expect(sharesAfter.sub(sharesBefore)).eq(sharesToWithdraw);
            });
        });
    });
});
