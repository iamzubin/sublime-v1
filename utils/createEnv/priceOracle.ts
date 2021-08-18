import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';

import DeployHelper from '../deploys';

import { PriceOracle } from '@typechain/PriceOracle';
import { SublimeProxy } from '@typechain/SublimeProxy';
import { Address } from 'hardhat-deploy/dist/types';
import { PriceOracleSource } from '@utils/types';

export async function createPriceOracle(proxyAdmin: SignerWithAddress, admin: SignerWithAddress): Promise<PriceOracle> {
    let deployHelper: DeployHelper = await new DeployHelper(proxyAdmin);
    let priceOracleLogic: PriceOracle = await deployHelper.helper.deployPriceOracle();
    let priceOracleProxy: SublimeProxy = await deployHelper.helper.deploySublimeProxy(priceOracleLogic.address, proxyAdmin.address);
    let priceOracle: PriceOracle = await deployHelper.helper.getPriceOracle(priceOracleProxy.address);
    await priceOracle.connect(admin).initialize(admin.address);
    return priceOracle;
}

export async function setPriceOracleFeeds(priceOracle: PriceOracle, admin: SignerWithAddress, pricePairs: PriceOracleSource[]) {
    for (let index = 0; index < pricePairs.length; index++) {
        const pair = pricePairs[index];
        await priceOracle.connect(admin).setChainlinkFeedAddress(pair.tokenAddress, pair.feedAggregator);
    }
}
