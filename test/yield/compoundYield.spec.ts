import { CompoundYield, SublimeProxy, SavingsAccount } from '../../typechain';
import { waffle, ethers } from 'hardhat';

import DeployHelper from '../../utils/deploys';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
const { loadFixture } = waffle;

import { CompoundPair } from '../../utils/types';
import { Contracts } from '../../existingContracts/compound.json';
import { zeroAddress } from '../../utils/constants';

describe('Compound Yield', async () => {
    let compoundYield: CompoundYield;
    let admin: SignerWithAddress;
    let mockSavingsAccount: SignerWithAddress;
    let pair: CompoundPair[];

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
    });

    it('Test 1', async () => {});
    it('Test 2', async () => {});
    it('Test 3', async () => {});

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
