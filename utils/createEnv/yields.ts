import { AaveYield } from '@typechain/AaveYield';
import { CompoundYield } from '@typechain/CompoundYield';
import { YearnYield } from '@typechain/YearnYield';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';

import DeployHelper from '../deploys';

import { SublimeProxy } from '@typechain/SublimeProxy';
import { Address } from 'hardhat-deploy/dist/types';

import { aaveYieldParams } from '../../utils/constants';
import { SavingsAccount } from '@typechain/SavingsAccount';
import { CompoundPair, YearnPair } from '../../utils/types';
import { IYield } from '@typechain/IYield';
import { IYield__factory } from '../../typechain/factories/IYield__factory';
import { NoYield } from '../../typechain/NoYield';

import { WETH9 } from '../../existingContracts/tokens.json';

export async function createAaveYieldWithInit(
    proxyAdmin: SignerWithAddress,
    admin: SignerWithAddress,
    savingsAccount: SavingsAccount
): Promise<IYield> {
    let deployHelper: DeployHelper = new DeployHelper(proxyAdmin);

    let aaveYieldLogic: AaveYield = await deployHelper.core.deployAaveYield();
    let aaveYieldProxy: SublimeProxy = await deployHelper.helper.deploySublimeProxy(aaveYieldLogic.address, proxyAdmin.address);
    let aaveYield: AaveYield = await deployHelper.core.getAaveYield(aaveYieldProxy.address);

    await aaveYield
        .connect(admin)
        .initialize(
            admin.address,
            savingsAccount.address,
            aaveYieldParams._wethGateway,
            aaveYieldParams._protocolDataProvider,
            aaveYieldParams._lendingPoolAddressesProvider
        );

    return IYield__factory.connect(aaveYield.address, admin);
}

export async function createCompoundYieldWithInit(
    proxyAdmin: SignerWithAddress,
    admin: SignerWithAddress,
    savingsAccount: SavingsAccount,
    pairs: CompoundPair[]
): Promise<IYield> {
    let deployHelper: DeployHelper = new DeployHelper(proxyAdmin);
    let compoundYieldLogic: CompoundYield = await deployHelper.core.deployCompoundYield();
    let compoundYieldProxy: SublimeProxy = await deployHelper.helper.deploySublimeProxy(compoundYieldLogic.address, proxyAdmin.address);
    let compoundYield: CompoundYield = await deployHelper.core.getCompoundYield(compoundYieldProxy.address);

    await compoundYield.connect(admin).initialize(admin.address, savingsAccount.address);

    for (let index = 0; index < pairs.length; index++) {
        const pair = pairs[index];
        await compoundYield.connect(admin).updateProtocolAddresses(pair.asset, pair.liquidityToken);
    }

    await compoundYield.connect(admin).updateIweth9(WETH9);
    return IYield__factory.connect(compoundYield.address, admin);
}

export async function createYearnYieldWithInit(
    proxyAdmin: SignerWithAddress,
    admin: SignerWithAddress,
    savingsAccount: SavingsAccount,
    pairs: YearnPair[]
): Promise<IYield> {
    let deployHelper: DeployHelper = new DeployHelper(proxyAdmin);
    let yearnYieldLogic: YearnYield = await deployHelper.core.deployYearnYield();
    let yearnYieldProxy: SublimeProxy = await deployHelper.helper.deploySublimeProxy(yearnYieldLogic.address, proxyAdmin.address);
    let yearnYield: YearnYield = await deployHelper.core.getYearnYield(yearnYieldProxy.address);

    await yearnYield.connect(admin).initialize(admin.address, savingsAccount.address);

    for (let index = 0; index < pairs.length; index++) {
        const pair = pairs[index];
        await yearnYield.connect(admin).updateProtocolAddresses(pair.asset, pair.liquidityToken);
    }
    await yearnYield.connect(admin).updateIweth9(WETH9);
    return IYield__factory.connect(yearnYield.address, admin);
}

export async function createNoYieldWithInit(
    proxyAdmin: SignerWithAddress,
    admin: SignerWithAddress,
    savingsAccount: SavingsAccount
): Promise<IYield> {
    let deployHelper: DeployHelper = new DeployHelper(proxyAdmin);
    let noYieldLogic: NoYield = await deployHelper.core.deployNoYield();
    let noYieldProxy: SublimeProxy = await deployHelper.helper.deploySublimeProxy(noYieldLogic.address, proxyAdmin.address);
    let noYield: NoYield = await deployHelper.core.getNoYield(noYieldProxy.address);

    await noYield.connect(admin).initialize(admin.address, savingsAccount.address);

    return IYield__factory.connect(noYield.address, admin);
}
