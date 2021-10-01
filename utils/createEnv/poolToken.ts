import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';

import DeployHelper from '../deploys';

import { PoolToken } from '@typechain/PoolToken';
import { SublimeProxy } from '@typechain/SublimeProxy';

export async function createPoolToken(proxyAdmin: SignerWithAddress): Promise<PoolToken> {
    let deployHelper: DeployHelper = new DeployHelper(proxyAdmin);
    let poolTokenLogic: PoolToken = await deployHelper.pool.deployPoolToken();
    let poolTokenProxy: SublimeProxy = await deployHelper.helper.deploySublimeProxy(poolTokenLogic.address, proxyAdmin.address);
    let poolToken: PoolToken = await deployHelper.pool.getPoolToken(poolTokenProxy.address);
    return poolToken;
}
