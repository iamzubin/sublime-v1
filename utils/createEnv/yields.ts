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

export async function createAaveYieldWithInit(
    proxyAdmin: SignerWithAddress,
    admin: SignerWithAddress,
    savingsAccount: SavingsAccount
): Promise<AaveYield> {
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

    return aaveYield;
}

export async function createCompoundYieldWithInit(
    proxyAdmin: SignerWithAddress,
    admin: SignerWithAddress,
    savingsAccount: SavingsAccount,
    pairs: CompoundPair[]
): Promise<CompoundYield> {
    let deployHelper: DeployHelper = new DeployHelper(proxyAdmin);
    let compoundYieldLogic: CompoundYield = await deployHelper.core.deployCompoundYield();
    let compoundYieldProxy: SublimeProxy = await deployHelper.helper.deploySublimeProxy(compoundYieldLogic.address, proxyAdmin.address);
    let compoundYield: CompoundYield = await deployHelper.core.getCompoundYield(compoundYieldProxy.address);

    await compoundYield.connect(admin).initialize(admin.address, savingsAccount.address);

    for (let index = 0; index < pairs.length; index++) {
        const pair = pairs[index];
        await compoundYield.connect(admin).updateProtocolAddresses(pair.asset, pair.liquidityToken);
    }

    return compoundYield;
}

export async function createYearnYieldWithInit(
    proxyAdmin: SignerWithAddress,
    admin: SignerWithAddress,
    savingsAccount: SavingsAccount,
    pairs: YearnPair[]
): Promise<YearnYield> {
    let deployHelper: DeployHelper = new DeployHelper(proxyAdmin);
    let yearnYieldLogic: YearnYield = await deployHelper.core.deployYearnYield();
    let yearnYieldProxy: SublimeProxy = await deployHelper.helper.deploySublimeProxy(yearnYieldLogic.address, proxyAdmin.address);
    let yearnYield: YearnYield = await deployHelper.core.getYearnYield(yearnYieldProxy.address);

    await yearnYield.connect(admin).initialize(admin.address, savingsAccount.address);

    for (let index = 0; index < pairs.length; index++) {
        const pair = pairs[index];
        await yearnYield.connect(admin).updateProtocolAddresses(pair.asset, pair.liquidityToken);
    }

    return yearnYield;
}
