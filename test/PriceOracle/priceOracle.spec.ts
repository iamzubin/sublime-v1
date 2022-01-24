import { PriceOracle, SublimeProxy, IUniswapV3Factory } from '../../typechain';
import { waffle, ethers } from 'hardhat';

import DeployHelper from '../../utils/deploys';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';

import { ChainlinkPriceOracleData, UniswapPoolData } from '../../utils/types';

const { loadFixture } = waffle;
import { Contracts } from '../../existingContracts/compound.json';
import { ChainLinkAggregators } from '../../config/constants';
import { BigNumber } from 'ethers';
import { expectApproxEqual } from '../../utils/helpers';

const uniswapV3FactoryContract = '0x1F98431c8aD98523631AE4a59f267346ea31F984';

describe('Price Oracle', async () => {
    let priceOracle: PriceOracle;
    let admin: SignerWithAddress;

    let chainlinkData: ChainlinkPriceOracleData[];
    let uniswapPoolData: UniswapPoolData[];
    let uniswapV3Factory: IUniswapV3Factory;

    async function fixture() {
        const [proxyAdmin, admin]: SignerWithAddress[] = await ethers.getSigners();
        let deployHelper: DeployHelper = new DeployHelper(proxyAdmin);
        uniswapV3Factory = await (await deployHelper.mock.getIUniswapV3Factory(uniswapV3FactoryContract)).connect(admin);

        let priceOracleLogic: PriceOracle = await deployHelper.helper.deployPriceOracle();
        let proxy: SublimeProxy = await deployHelper.helper.deploySublimeProxy(priceOracleLogic.address, proxyAdmin.address);
        let priceOracle = await deployHelper.helper.getPriceOracle(proxy.address);
        priceOracle = await priceOracle.connect(admin);
        await priceOracle.initialize(admin.address);

        for (let index = 0; index < chainlinkData.length; index++) {
            const element = chainlinkData[index];
            await priceOracle.setChainlinkFeedAddress(element.token, element.priceOracle);
        }

        for (let index = 0; index < uniswapPoolData.length; index++) {
            const element = uniswapPoolData[index];
            let uniswapPool = await uniswapV3Factory.getPool(element.token1, element.token2, element.fee);
            await priceOracle.setUniswapFeedAddress(element.token1, element.token2, uniswapPool);
        }

        return { priceOracle, admin, uniswapV3Factory };
    }

    beforeEach(async () => {
        chainlinkData = [
            { token: Contracts.USDT, priceOracle: ChainLinkAggregators['USDT/USD'] },
            { token: Contracts.WBTC, priceOracle: ChainLinkAggregators['BTC/USD'] },
        ];
        uniswapPoolData = [
            {
                token1: Contracts.USDT,
                token2: Contracts.WBTC,
                fee: '3000',
            },
        ];
        let result = await loadFixture(fixture);
        priceOracle = result.priceOracle;
        admin = result.admin;
        await priceOracle.connect(admin).setUniswapPriceAveragingPeriod(1000);
    });

    it('get chainlink latest price', async () => {
        let [chainlinkPrice, chainlinkDecimals]: BigNumber[] = await priceOracle
            .connect(admin)
            .getChainlinkLatestPrice(Contracts.WBTC, Contracts.USDT);
        let [uniswapPrice, uniswapDecimals]: BigNumber[] = await priceOracle
            .connect(admin)
            .getUniswapLatestPrice(Contracts.WBTC, Contracts.USDT);

        let scalingFactor = BigNumber.from(10).pow(100);
        let scaledUpChainlinkPrice = chainlinkPrice.mul(scalingFactor).div(BigNumber.from(10).pow(chainlinkDecimals));
        let scaledUpUniswapPrice = uniswapPrice.mul(scalingFactor).div(BigNumber.from(10).pow(uniswapDecimals));

        expectApproxEqual(scaledUpChainlinkPrice, scaledUpUniswapPrice, scaledUpUniswapPrice.div(10000), 'more than 0.01 % difference');
    });
});
