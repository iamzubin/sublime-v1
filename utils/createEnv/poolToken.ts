import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';

import DeployHelper from '../deploys';

import { PoolToken } from '@typechain/PoolToken';

export async function createPoolToken(proxyAdmin: SignerWithAddress): Promise<PoolToken> {
    let deployHelper: DeployHelper = new DeployHelper(proxyAdmin);
    let poolToken: PoolToken = await deployHelper.pool.deployPoolToken();
    return poolToken;
}
