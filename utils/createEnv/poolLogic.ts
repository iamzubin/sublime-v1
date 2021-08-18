import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';

import DeployHelper from '../deploys';

import { Pool } from '@typechain/Pool';

export async function createPool(proxyAdmin: SignerWithAddress): Promise<Pool> {
    let deployHelper: DeployHelper = new DeployHelper(proxyAdmin);
    let pool: Pool = await deployHelper.pool.deployPool();
    return pool;
}
