import { CompoundYield, SublimeProxy, SavingsAccount } from '../../typechain';
import { waffle, ethers, network } from 'hardhat';

import DeployHelper from '../../utils/deploys';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
const { loadFixture } = waffle;

import { CompoundPair } from '../../utils/types';
import { Contracts } from '../../existingContracts/compound.json';
import { WBTCWhale, zeroAddress } from '../../config/constants';
import { BigNumber } from 'ethers';
import { expect } from 'chai';

describe('Compound Yield', async () => {
    let compoundYield: CompoundYield;
    let admin: SignerWithAddress;
    let mockSavingsAccount: SignerWithAddress;
    let pair: CompoundPair[];
    let WBTCWhaleSigner: SignerWithAddress;

    async function fixture() {
        const [proxyAdmin, admin, mockSavingsAccount]: SignerWithAddress[] = await ethers.getSigners();
        let deployHelper: DeployHelper = new DeployHelper(proxyAdmin);
        let compoundYieldLogic: CompoundYield = await deployHelper.core.deployCompoundYield();
        let proxy: SublimeProxy = await deployHelper.helper.deploySublimeProxy(compoundYieldLogic.address, proxyAdmin.address);

        let compoundYield: CompoundYield = await (await deployHelper.core.getCompoundYield(proxy.address)).connect(admin);
        await compoundYield.initialize(admin.address, mockSavingsAccount.address);
        for (let index = 0; index < pair.length; index++) {
            const element = pair[index];
            await compoundYield.updateProtocolAddresses(element.asset, element.liquidityToken);
        }
        return { compoundYield, admin, mockSavingsAccount };
    }

    before(async () => {
        await network.provider.request({
            method: 'hardhat_impersonateAccount',
            params: [WBTCWhale],
        });
    });

    beforeEach(async () => {
        pair = [
            { asset: Contracts.DAI, liquidityToken: Contracts.cDAI },
            { asset: zeroAddress, liquidityToken: Contracts.cETH },
            { asset: Contracts.USDT, liquidityToken: Contracts.cUSDT },
            { asset: Contracts.USDC, liquidityToken: Contracts.cUSDC },
            { asset: Contracts.WBTC, liquidityToken: Contracts.cWBTC2 },
        ];
        let result = await loadFixture(fixture);
        compoundYield = result.compoundYield;
        admin = result.admin;
        mockSavingsAccount = result.mockSavingsAccount;
        WBTCWhaleSigner = await ethers.getSigner(WBTCWhale);
    });

    it('Test 1', async () => {});
    it('Test 2', async () => {});
    it('Test 3', async () => {});
    it('Claim Comp Tokens', async () => {
        let amountToTransfer = BigNumber.from(1).mul(BigNumber.from(10).pow(8)); // 1 BTC
        let deployHelper = new DeployHelper(WBTCWhaleSigner);
        let WBTC = await deployHelper.mock.getMockERC20Detailed(Contracts.WBTC);
        await WBTC.transfer(admin.address, amountToTransfer);

        await WBTC.connect(admin).approve(compoundYield.address, amountToTransfer);
        await compoundYield.connect(mockSavingsAccount).lockTokens(admin.address, Contracts.WBTC, amountToTransfer);

        let compToken = await deployHelper.mock.getMockERC20Detailed(Contracts.Comp);
        let compTokenBalanceBefore = await compToken.balanceOf(admin.address);
        await compoundYield.connect(admin).claimCompTokens(Contracts.Comptroller, Contracts.Comp, admin.address);
        let compTokenBalanceAfter = await compToken.balanceOf(admin.address);
        expect(compTokenBalanceAfter.sub(compTokenBalanceBefore)).gt(0); // amount of COMP token gain should be more than 0
    });

    describe('Sub section Tests', async () => {
        let newSavingsAccount: SavingsAccount;

        async function savingsAccountUpdatedFixture() {
            let savingAccountAddress = '0x0000222220000222220000222220000222220000';
            await compoundYield.updateSavingsAccount(savingAccountAddress);
            let deployHelper: DeployHelper = new DeployHelper(admin);

            let savingsAccount: SavingsAccount = await deployHelper.core.getSavingsAccount(savingAccountAddress);
            return { compoundYield, admin, savingsAccount };
        }

        beforeEach(async () => {
            let result = await loadFixture(savingsAccountUpdatedFixture);
            newSavingsAccount = result.savingsAccount;
        });

        it('N-Test 1', async () => {});
        it('N-Test 2', async () => {});
        it('N-Test 3', async () => {});
    });
});
