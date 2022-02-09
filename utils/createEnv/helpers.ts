import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { CreditLineUtils } from '@typechain/CreditLineUtils';
import { PoolUtils } from '@typechain/PoolUtils';
import { SavingsAccountEthUtils } from '@typechain/SavingsAccountEthUtils';
import { Address } from 'hardhat-deploy/dist/types';
import DeployHelper from '../deploys';

export async function createPoolUtils(proxyAdmin: SignerWithAddress, weth: Address, bin: Address): Promise<PoolUtils> {
    let deployHeler: DeployHelper = new DeployHelper(proxyAdmin);
    return await deployHeler.helper.deployPoolUtils(weth, bin);
}

export async function createCreditLineUtils(
    proxyAdmin: SignerWithAddress,
    weth: Address,
    creditLineContractAddress: Address
): Promise<CreditLineUtils> {
    let deployHelper: DeployHelper = new DeployHelper(proxyAdmin);
    return await deployHelper.helper.deployCreditLinesUtils(weth, creditLineContractAddress);
}

export async function createSavingsAccountEthUtils(
    proxyAdmin: SignerWithAddress,
    weth: Address,
    savingsAccountContractAddress: Address
): Promise<SavingsAccountEthUtils> {
    let deployHelper: DeployHelper = new DeployHelper(proxyAdmin);
    return await deployHelper.helper.deploySavingsAccountEthUtils(weth, savingsAccountContractAddress);
}
