import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { calculateNewPoolAddress, createEnvironment, createNewPool } from '../../utils/createEnv';
import { getPoolInitSigHash } from '../../utils/createEnv/poolLogic';
import { CreditLineDefaultStrategy, Environment, PoolCreateParams } from '../../utils/types';

import hre from 'hardhat';
const { waffle } = hre;
const { loadFixture } = waffle;

import { CompoundPair } from '../../utils/types';
import { Contracts } from '../../existingContracts/compound.json';
import { ChainLinkAggregators, WBTCWhale, zeroAddress, Binance7, WhaleAccount, DAIWhale } from '../../config/constants';
import { sha256 } from 'ethers/lib/utils';
import DeployHelper from '../../utils/deploys';
import { BigNumber, BigNumberish } from 'ethers';
import { expect } from 'chai';

import { Pool } from '@typechain/Pool';
import { ERC20 } from '@typechain/ERC20';
import { IYield } from '@typechain/IYield';
import { ERC20Detailed } from '@typechain/ERC20Detailed';
import { timeTravel, blocksTravel } from '../../utils/time';
import { Repayments } from '@typechain/Repayments';

describe('Create Pools (Compound Strategy)', async () => {
    let env: Environment;
    let admin: SignerWithAddress;
    let borrower: SignerWithAddress;
    let lender: SignerWithAddress;
    let protocolFeeCollector: SignerWithAddress;
    let extraLenders: SignerWithAddress[];
    let pair: CompoundPair[];
    let _collectionPeriod: number = 1000000;
    let repayments: Repayments;

    let snapshotId: any;

    async function fixture() {
        let env: Environment = await createEnvironment(
            hre,
            [WBTCWhale, WhaleAccount, Binance7, DAIWhale],
            pair,
            [],
            [
                { tokenAddress: zeroAddress, feedAggregator: ChainLinkAggregators['ETH/USD'] },
                { tokenAddress: Contracts.DAI, feedAggregator: ChainLinkAggregators['DAI/USD'] },
                { tokenAddress: Contracts.WBTC, feedAggregator: ChainLinkAggregators['BTC/USD'] },
                { tokenAddress: Contracts.USDT, feedAggregator: ChainLinkAggregators['USDT/USD'] },
                { tokenAddress: Contracts.USDC, feedAggregator: ChainLinkAggregators['USDC/USD'] },
            ],
            { votingPassRatio: 100 },
            { gracePenalityRate: 100, gracePeriodFraction: 100000 },
            {
                admin: '',
                _collectionPeriod,
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

        await env.poolFactory.connect(env.entities.admin).updateProtocolFeeFraction(BigNumber.from(1).mul(BigNumber.from(10).pow(28))); // 1%

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
            repayments: env.repayments,
        };
    }

    before(async () => {
        pair = [
            { asset: Contracts.DAI, liquidityToken: Contracts.cDAI },
            { asset: zeroAddress, liquidityToken: Contracts.cETH },
            { asset: Contracts.USDT, liquidityToken: Contracts.cUSDT },
            { asset: Contracts.USDC, liquidityToken: Contracts.cUSDC },
            { asset: Contracts.WBTC, liquidityToken: Contracts.cWBTC2 },
        ];
        let result = await fixture();
        env = result.env;
        admin = result.admin;
        borrower = result.borrower;
        lender = result.lender;
        protocolFeeCollector = result.protocolFeeCollector;
        extraLenders = result.extraLenders;
        repayments = result.repayments;
    });

    beforeEach(async () => {
        snapshotId = await hre.network.provider.request({
            method: 'evm_snapshot',
            params: [],
        });
    });

    afterEach(async () => {
        await hre.network.provider.request({
            method: 'evm_revert',
            params: [snapshotId],
        });
    });

    it('Create Pool', async () => {
        let salt = sha256(Buffer.from('salt-1'));
        let { admin, borrower } = env.entities;
        let deployHelper: DeployHelper = new DeployHelper(admin);
        let USDT = await deployHelper.mock.getMockERC20(Contracts.USDT);
        let WBTC = await deployHelper.mock.getMockERC20(Contracts.WBTC);
        let iyield = await deployHelper.mock.getYield(env.yields.compoundYield.address);

        let generatedPoolAddress = await env.poolFactory
            .connect(env.entities.borrower)
            .preComputeAddress(salt, env.entities.borrower.address);
        // console.log({ generatedPoolAddress });

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

        expect(pool.address).to.eq(generatedPoolAddress);
    });

    describe('WBTC-USDC pool', async () => {
        let pool: Pool;

        let USDC: ERC20Detailed;
        let WBTC: ERC20;
        let iyield: IYield;

        let salt: string;

        beforeEach(async () => {
            // salt = sha256(Buffer.from(new Date().valueOf().toString()));
            salt = sha256(Buffer.from('salt2'));
            admin = env.entities.admin;
            borrower = env.entities.borrower;
            lender = env.entities.lender;
            extraLenders = env.entities.extraLenders;

            let deployHelper: DeployHelper = new DeployHelper(admin);
            USDC = await deployHelper.mock.getMockERC20Detailed(Contracts.USDC);
            WBTC = await deployHelper.mock.getMockERC20(Contracts.WBTC);
            iyield = await deployHelper.mock.getYield(env.yields.compoundYield.address);

            let generatedPoolAddress = await env.poolFactory
                .connect(env.entities.borrower)
                .preComputeAddress(salt, env.entities.borrower.address);

            await WBTC.connect(env.impersonatedAccounts[0]).transfer(admin.address, '500000000');
            await WBTC.connect(admin).transfer(borrower.address, '500000000');
            await WBTC.connect(borrower).approve(generatedPoolAddress, '500000000');

            let USDC_decimals = await USDC.decimals();
            let amountTransferedToLenders = BigNumber.from(100000).mul(BigNumber.from(10).pow(USDC_decimals));

            await USDC.connect(env.impersonatedAccounts[2]).transfer(lender.address, amountTransferedToLenders);

            for (let index = 0; index < extraLenders.length; index++) {
                const element = extraLenders[index];
                await USDC.connect(env.impersonatedAccounts[1]).transfer(element.address, amountTransferedToLenders);
            }

            pool = await createNewPool(env, USDC, WBTC, iyield, salt, false, {
                _poolSize: BigNumber.from(1000000).mul(BigNumber.from(10).pow(USDC_decimals)), // max possible borrow tokens in pool
                _borrowRate: BigNumber.from(5).mul(BigNumber.from(10).pow(28)), // 100 * 10^28 in contract means 100% to outside
                _collateralAmount: BigNumber.from(5).mul(BigNumber.from(10).pow(8)), // 5 wbtc
                _collateralRatio: BigNumber.from(1).mul(BigNumber.from(10).pow(28)), //1 * 10**28
                _collectionPeriod,
                _loanWithdrawalDuration: 200,
                _noOfRepaymentIntervals: 100,
                _repaymentInterval: _collectionPeriod,
            });
        });

        it('Check USDC Pool', async () => {});

        describe('Lend Tokens', async () => {
            beforeEach(async () => {
                let USDC_decimals = await USDC.decimals();
                let amountWithLenders = BigNumber.from(10000).mul(BigNumber.from(10).pow(USDC_decimals));
                await USDC.connect(lender).approve(pool.address, amountWithLenders);
                await expect(pool.connect(lender).lend(lender.address, amountWithLenders, zeroAddress))
                    .to.emit(pool, 'LiquiditySupplied')
                    .withArgs(amountWithLenders, lender.address);

                for (let index = 0; index < 5; index++) {
                    const element = extraLenders[index];
                    await USDC.connect(element).approve(pool.address, amountWithLenders);
                    await expect(pool.connect(element).lend(element.address, amountWithLenders, zeroAddress))
                        .to.emit(pool, 'LiquiditySupplied')
                        .withArgs(amountWithLenders, element.address);
                }
            });

            it('Check Interest per second', async () => {
                await timeTravel(hre.network, _collectionPeriod);
                await blocksTravel(hre.network, 5);
                await pool.connect(borrower).withdrawBorrowedAmount();
                let ips = await repayments.connect(borrower).getInterestPerSecond(pool.address);
                console.log({ interestPerSecond: ips.toString() });
                expect(ips).gt(0);
            });
        });
    });

    describe('WBTC-DAI pool', async () => {
        let pool: Pool;

        let DAI: ERC20Detailed;
        let WBTC: ERC20;
        let iyield: IYield;

        let salt: string;

        beforeEach(async () => {
            // salt = sha256(Buffer.from(new Date().valueOf().toString()));
            salt = sha256(Buffer.from('salt3'));
            admin = env.entities.admin;
            borrower = env.entities.borrower;
            lender = env.entities.lender;
            extraLenders = env.entities.extraLenders;

            let deployHelper: DeployHelper = new DeployHelper(admin);
            DAI = await deployHelper.mock.getMockERC20Detailed(Contracts.DAI);
            WBTC = await deployHelper.mock.getMockERC20(Contracts.WBTC);
            iyield = await deployHelper.mock.getYield(env.yields.compoundYield.address);

            let generatedPoolAddress = await env.poolFactory
                .connect(env.entities.borrower)
                .preComputeAddress(salt, env.entities.borrower.address);

            await WBTC.connect(env.impersonatedAccounts[0]).transfer(admin.address, '500000000');
            await WBTC.connect(admin).transfer(borrower.address, '500000000');
            await WBTC.connect(borrower).approve(generatedPoolAddress, '500000000');

            let DAI_decimals = await DAI.decimals();
            let amountTransferedToLenders = BigNumber.from(100000).mul(BigNumber.from(10).pow(DAI_decimals));

            await DAI.connect(env.impersonatedAccounts[3]).transfer(lender.address, amountTransferedToLenders);

            for (let index = 0; index < extraLenders.length; index++) {
                const element = extraLenders[index];
                await DAI.connect(env.impersonatedAccounts[1]).transfer(element.address, amountTransferedToLenders);
            }

            pool = await createNewPool(env, DAI, WBTC, iyield, salt, false, {
                _poolSize: BigNumber.from(1000000).mul(BigNumber.from(10).pow(DAI_decimals)), // max possible borrow tokens in pool
                _borrowRate: BigNumber.from(5).mul(BigNumber.from(10).pow(28)), // 100 * 10^28 in contract means 100% to outside
                _collateralAmount: BigNumber.from(5).mul(BigNumber.from(10).pow(8)), // 5 wbtc
                _collateralRatio: BigNumber.from(1).mul(BigNumber.from(10).pow(28)), //1 * 10**28
                _collectionPeriod,
                _loanWithdrawalDuration: 200,
                _noOfRepaymentIntervals: 100,
                _repaymentInterval: _collectionPeriod,
            });
        });

        describe('Lenders supply tokens to pools', async () => {
            beforeEach(async () => {
                let DAI_decimals = await DAI.decimals();
                let amountWithLenders = BigNumber.from(10000).mul(BigNumber.from(10).pow(DAI_decimals));
                await DAI.connect(lender).approve(pool.address, amountWithLenders);
                await expect(pool.connect(lender).lend(lender.address, amountWithLenders, zeroAddress))
                    .to.emit(pool, 'LiquiditySupplied')
                    .withArgs(amountWithLenders, lender.address);

                for (let index = 0; index < 5; index++) {
                    const element = extraLenders[index];
                    await DAI.connect(element).approve(pool.address, amountWithLenders);
                    await expect(pool.connect(element).lend(element.address, amountWithLenders, zeroAddress))
                        .to.emit(pool, 'LiquiditySupplied')
                        .withArgs(amountWithLenders, element.address);
                }
            });

            it('Check Lenders lending tokens', async () => {});

            describe('Borrow from the pool', async () => {
                let borrowerBalanceBefore: BigNumberish;
                let protocolFeeBefore: BigNumberish;
                beforeEach(async () => {
                    await timeTravel(hre.network, _collectionPeriod);
                    await blocksTravel(hre.network, 5);
                    borrowerBalanceBefore = await DAI.balanceOf(borrower.address);
                    protocolFeeBefore = await DAI.balanceOf(protocolFeeCollector.address);
                    await pool.connect(borrower).withdrawBorrowedAmount();
                });

                it('Check interest per second', async () => {
                    let ips = await repayments.connect(borrower).getInterestPerSecond(pool.address);
                    console.log({ interestPerSecond: ips.toString() });
                    expect(ips).gt(0);
                });

                it('Check borrowed amount', async () => {
                    let borrowerBalanceAfter = await DAI.balanceOf(borrower.address);
                    let protocolFeeAfter = await DAI.balanceOf(protocolFeeCollector.address);
                    expect(protocolFeeAfter).gt(protocolFeeBefore);
                    expect(borrowerBalanceAfter).gt(borrowerBalanceBefore);
                });

                describe('Repayments', async () => {
                    let DAI_decimals: number;
                    beforeEach(async () => {
                        DAI_decimals = await DAI.decimals();
                        let extraAmount = BigNumber.from(100000).mul(BigNumber.from(10).pow(DAI_decimals));
                        await DAI.connect(env.impersonatedAccounts[1]).transfer(borrower.address, extraAmount); // transfer extra amount to borrower to repay the loan
                        borrowerBalanceBefore = await DAI.balanceOf(borrower.address);
                    });

                    it('Repay 10 DAI', async () => {
                        // let nextInstallmentDeadline = await repayments.connect(borrower).getNextInstalmentDeadline(pool.address);
                        // nextInstallmentDeadline = nextInstallmentDeadline.div(BigNumber.from(10).pow(30)).sub(100000).div(1000);
                        // await timeTravel(hre.network, nextInstallmentDeadline.toNumber());
                        let repayAmount = BigNumber.from(10).mul(BigNumber.from(10).pow(DAI_decimals));
                        await DAI.connect(borrower).approve(repayments.address, repayAmount);
                        await repayments.connect(borrower).repay(pool.address, repayAmount);
                    });

                    it('Repay 1000 DAI', async () => {
                        let repayAmount = BigNumber.from(1000).mul(BigNumber.from(10).pow(DAI_decimals));
                        await DAI.connect(borrower).approve(repayments.address, repayAmount);
                        await repayments.connect(borrower).repay(pool.address, repayAmount);
                    });

                    it.only('Repay 10 DAI amd then principle', async () => {
                        let repayAmount = BigNumber.from(10).mul(BigNumber.from(10).pow(DAI_decimals));
                        await DAI.connect(borrower).approve(repayments.address, repayAmount);
                        await repayments.connect(borrower).repay(pool.address, repayAmount);

                        let largeAmountToApprove = BigNumber.from(1000000000).mul(BigNumber.from(10).pow(DAI_decimals));
                        await DAI.connect(borrower).approve(repayments.address, largeAmountToApprove);
                        await repayments.connect(borrower).repayPrincipal(pool.address);
                        let borrowerBalanceAfter = await DAI.balanceOf(borrower.address);
                        console.log({ amountPaid: BigNumber.from(borrowerBalanceBefore).sub(borrowerBalanceAfter).toString() });
                    });
                });
            });
        });
    });
});
