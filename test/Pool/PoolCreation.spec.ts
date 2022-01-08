import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { calculateNewPoolAddress, createEnvironment, createNewPool } from '../../utils/createEnv';
import { getPoolInitSigHash } from '../../utils/createEnv/poolLogic';
import { CreditLineDefaultStrategy, Environment, PoolCreateParams } from '../../utils/types';

import hre from 'hardhat';
const { waffle } = hre;
const { loadFixture } = waffle;

import { CompoundPair } from '../../utils/types';
import { Contracts } from '../../existingContracts/compound.json';
import { ChainLinkAggregators, WBTCWhale, zeroAddress, Binance7, WhaleAccount } from '../../config/constants';
import { getPoolAddress } from '../../utils/helpers';
import { sha256 } from 'ethers/lib/utils';
import DeployHelper from '../../utils/deploys';
import { BigNumber } from 'ethers';
import { expect } from 'chai';
import poolContractArtifact from '../../artifacts/contracts/Pool/Pool.sol/Pool.json';

describe('Create Pools', async () => {
    let env: Environment;
    let admin: SignerWithAddress;
    let borrower: SignerWithAddress;
    let lender: SignerWithAddress;
    let protocolFeeCollector: SignerWithAddress;
    let extraLenders: SignerWithAddress[];
    let pair: CompoundPair[];

    async function fixture() {
        let env: Environment = await createEnvironment(
            hre,
            [WBTCWhale, WhaleAccount, Binance7],
            pair,
            [],
            [
                { tokenAddress: zeroAddress, feedAggregator: ChainLinkAggregators['ETH/USD'] },
                { tokenAddress: Contracts.DAI, feedAggregator: ChainLinkAggregators['DAI/USD'] },
                { tokenAddress: Contracts.WBTC, feedAggregator: ChainLinkAggregators['BTC/USD'] },
                { tokenAddress: Contracts.USDT, feedAggregator: ChainLinkAggregators['USDT/USD'] },
            ],
            { votingPassRatio: 100 },
            { gracePenalityRate: 100, gracePeriodFraction: 100000 },
            {
                admin: '',
                _collectionPeriod: 1000000,
                _loanWithdrawalDuration: 1000000,
                _marginCallDuration: 1000000,
                _poolInitFuncSelector: getPoolInitSigHash(),
                _liquidatorRewardFraction: 1000000,
                _poolCancelPenalityFraction: 10000000,
                _protocolFeeFraction: 10000000,
                protocolFeeCollector: '',
                _minBorrowFraction: 100000000,
                noStrategy: '',
            },
            CreditLineDefaultStrategy.NoStrategy,
            {
                _protocolFeeFraction: 10000000,
                _liquidatorRewardFraction: 1000000000,
            },
            {
                activationDelay: 1,
            }
        );

        let deployHelper = new DeployHelper(env.impersonatedAccounts[0]);
        let wbtc = await deployHelper.mock.getMockERC20Detailed(Contracts.WBTC);
        let amount = BigNumber.from(10)
            .pow(await wbtc.decimals())
            .mul(10);
        await wbtc.transfer(env.entities.borrower.address, amount);

        return {
            env,
            admin: env.entities.admin,
            borrower: env.entities.borrower,
            lender: env.entities.lender,
            protocolFeeCollector: env.entities.protocolFeeCollector,
            extraLenders: env.entities.extraLenders,
        };
    }

    beforeEach(async () => {
        pair = [
            { asset: Contracts.DAI, liquidityToken: Contracts.cDAI },
            { asset: zeroAddress, liquidityToken: Contracts.cETH },
            { asset: Contracts.USDT, liquidityToken: Contracts.cUSDT },
            { asset: Contracts.USDC, liquidityToken: Contracts.cUSDC },
            { asset: Contracts.WBTC, liquidityToken: Contracts.cWBTC2 },
        ];
        let result = await loadFixture(fixture);
        env = result.env;
        admin = result.admin;
        borrower = result.borrower;
        lender = result.lender;
        protocolFeeCollector = result.protocolFeeCollector;
        extraLenders = result.extraLenders;
    });

    it('Create Pool', async () => {
        let salt = sha256(Buffer.from('salt-1'));
        let { admin, borrower, lender } = env.entities;
        let deployHelper: DeployHelper = new DeployHelper(admin);
        let USDT = await deployHelper.mock.getMockERC20(Contracts.USDT);
        let WBTC = await deployHelper.mock.getMockERC20(Contracts.WBTC);
        let iyield = await deployHelper.mock.getYield(env.yields.compoundYield.address);

        console.log(env.mockTokenContracts[1].name);

        let generatedPoolAddress = await env.poolFactory.connect(env.entities.borrower).preComputeAddress(salt);
        console.log({ generatedPoolAddress });

        await WBTC.connect(env.impersonatedAccounts[0]).transfer(admin.address, '100000000');
        await WBTC.connect(admin).transfer(borrower.address, '100000000');
        await WBTC.connect(borrower).approve(generatedPoolAddress, '100000000');

        let pool = await createNewPool(env, USDT, WBTC, iyield, salt, false, {
            _poolSize: BigNumber.from(1000).mul(BigNumber.from(10).pow(6)), // max possible borrow tokens in pool
            _borrowRate: BigNumber.from(5).mul(BigNumber.from(10).pow(28)), // 100 * 10^28 in contract means 100% to outside
            _collateralAmount: BigNumber.from(1).mul(BigNumber.from(10).pow(8)), // 1 wbtc
            _collateralRatio: BigNumber.from(250).mul(BigNumber.from(10).pow(28)), //250 * 10**28
            _collectionPeriod: 10000,
            _loanWithdrawalDuration: 200,
            _noOfRepaymentIntervals: 100,
            _repaymentInterval: 1000,
        });

        console.log({ actualPoolAddress: pool.address });
    });
});
