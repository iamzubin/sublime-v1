import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';

import DeployHelper from '../deploys';

import { Pool } from '@typechain/Pool';
import { SublimeProxy } from '@typechain/SublimeProxy';

export async function createPool(proxyAdmin: SignerWithAddress): Promise<Pool> {
    let deployHelper: DeployHelper = new DeployHelper(proxyAdmin);
    let poolLogic: Pool = await deployHelper.pool.deployPool();
    let poolProxy: SublimeProxy = await deployHelper.helper.deploySublimeProxy(poolLogic.address, proxyAdmin.address);
    let pool: Pool = await deployHelper.pool.getPool(poolProxy.address);
    return pool;
}
