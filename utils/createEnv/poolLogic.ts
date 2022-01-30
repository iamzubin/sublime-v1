import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';

import DeployHelper from '../deploys';

import { Pool } from '@typechain/Pool';
import { Address } from 'hardhat-deploy/dist/types';

export async function createPool(
    proxyAdmin: SignerWithAddress,
    priceOracle: Address,
    savingsAccount: Address,
    extension: Address,
    repaymentImpl: Address
): Promise<Pool> {
    let deployHelper: DeployHelper = new DeployHelper(proxyAdmin);
    let pool: Pool = await deployHelper.pool.deployPool(priceOracle, savingsAccount, extension, repaymentImpl);
    return pool;
}
