import { calculateNewPoolAddress, createEnvironment, createNewPool } from '../createEnv';
import {
    CompoundPair,
    CreditLineDefaultStrategy,
    CreditLineInitParams,
    Environment,
    ExtensionInitParams,
    // PoolCreateParams,
    PoolFactoryInitParams,
    PriceOracleSource,
    RepaymentsInitParams,
    YearnPair,
} from '../types';
import hre from 'hardhat';
const { ethers, network } = hre;
import { expect, assert } from 'chai';

import {
    extensionParams,
    repaymentParams,
    testPoolFactoryParams,
    createPoolParams,
    creditLineFactoryParams,
    WhaleAccount,
    zeroAddress,
    ChainLinkAggregators,
} from '../constants-Additions';

import DeployHelper from '../deploys';
import { ERC20 } from '../../typechain/ERC20';
import { sha256 } from '@ethersproject/sha2';
import { BigNumber, BigNumberish } from 'ethers';
import { IYield } from '@typechain/IYield';
import { Address } from 'hardhat-deploy/dist/types';
import { Pool } from '@typechain/Pool';
import { PoolToken } from '@typechain/PoolToken';
import { CompoundYield } from '@typechain/CompoundYield';
import { CreditLine } from '../../typechain/CreditLine';
import { Contracts } from '../../existingContracts/compound.json';
import { expectApproxEqual } from '../helpers';
import { incrementChain, timeTravel, blockTravel } from '../../utils/time';

export async function CreditLines(
    Amount: Number,
    WhaleAccount1: Address,
    WhaleAccount2: Address,
    BorrowToken: Address,
    CollateralToken: Address,
    liquidityBorrowToken: Address,
    liquidityCollateralToken: Address,
    chainlinkBorrow: Address,
    ChainlinkCollateral: Address
): Promise<any> {
    describe('CreditLines: Initial tests', async () => {
        let env: Environment;
        let pool: Pool;
        let poolAddress: Address;
        let poolToken: PoolToken;

        let deployHelper: DeployHelper;
        let BorrowAsset: ERC20;
        let CollateralAsset: ERC20;
        let iyield: IYield;
        let creditLine: CreditLine;
        let Compound: CompoundYield;

        before(async () => {
            env = await createEnvironment(
                hre,
                [WhaleAccount1, WhaleAccount2],
                [
                    { asset: BorrowToken, liquidityToken: liquidityBorrowToken },
                    { asset: CollateralToken, liquidityToken: liquidityCollateralToken },
                ] as CompoundPair[],
                [] as YearnPair[],
                [
                    { tokenAddress: BorrowToken, feedAggregator: chainlinkBorrow },
                    { tokenAddress: CollateralToken, feedAggregator: ChainlinkCollateral },
                ] as PriceOracleSource[],
                {
                    votingPassRatio: extensionParams.votingPassRatio,
                } as ExtensionInitParams,
                {
                    gracePenalityRate: repaymentParams.gracePenalityRate,
                    gracePeriodFraction: repaymentParams.gracePeriodFraction,
                } as RepaymentsInitParams,
                {
                    admin: '',
                    _collectionPeriod: testPoolFactoryParams._collectionPeriod,
                    _loanWithdrawalDuration: testPoolFactoryParams._loanWithdrawalDuration,
                    _marginCallDuration: testPoolFactoryParams._marginCallDuration,
                    _gracePeriodPenaltyFraction: testPoolFactoryParams._gracePeriodPenaltyFraction,
                    _poolInitFuncSelector: testPoolFactoryParams._poolInitFuncSelector,
                    _poolTokenInitFuncSelector: testPoolFactoryParams._poolTokenInitFuncSelector,
                    _liquidatorRewardFraction: testPoolFactoryParams._liquidatorRewardFraction,
                    _poolCancelPenalityFraction: testPoolFactoryParams._poolCancelPenalityFraction,
                    _protocolFeeFraction: testPoolFactoryParams._protocolFeeFraction,
                    protocolFeeCollector: '',
                    _minBorrowFraction: testPoolFactoryParams._minborrowFraction,
                } as PoolFactoryInitParams,
                CreditLineDefaultStrategy.Compound,
                {
                    _protocolFeeFraction: creditLineFactoryParams._protocolFeeFraction,
                    _liquidatorRewardFraction: creditLineFactoryParams._liquidatorRewardFraction,
                } as CreditLineInitParams
            );

            let salt = sha256(Buffer.from(`borrower-${new Date().valueOf()}`));
            let { admin, borrower, lender } = env.entities;
            deployHelper = new DeployHelper(admin);
            BorrowAsset = await deployHelper.mock.getMockERC20(env.mockTokenContracts[0].contract.address);
            CollateralAsset = await deployHelper.mock.getMockERC20(env.mockTokenContracts[1].contract.address);
            iyield = await deployHelper.mock.getYield(env.yields.compoundYield.address);

            let BTDecimals = await env.mockTokenContracts[0].contract.decimals();
            let CTDecimals = await env.mockTokenContracts[1].contract.decimals();

            poolAddress = await calculateNewPoolAddress(env, BorrowAsset, CollateralAsset, iyield, salt, false, {
                _poolSize: BigNumber.from(100).mul(BigNumber.from(10).pow(BTDecimals)),
                _volatilityThreshold: BigNumber.from(20).mul(BigNumber.from(10).pow(28)),
                _borrowRate: BigNumber.from(1).mul(BigNumber.from(10).pow(28)),
                _collateralAmount: BigNumber.from(Amount).mul(BigNumber.from(10).pow(CTDecimals)),
                // _collateralAmount: BigNumber.from(1).mul(BigNumber.from(10).pow(CTDecimals)),
                _collateralRatio: BigNumber.from(250).mul(BigNumber.from(10).pow(28)),
                _collectionPeriod: 10000,
                _loanWithdrawalDuration: 200,
                _noOfRepaymentIntervals: 100,
                _repaymentInterval: 1000,
            });

            // console.log({ calculatedPoolAddress: poolAddress });

            console.log('Borrow Token: ', env.mockTokenContracts[0].name);
            console.log('Collateral Token: ', env.mockTokenContracts[1].name);
            // console.log(await env.mockTokenContracts[0].contract.decimals());
            // console.log(await env.mockTokenContracts[1].contract.decimals());

            await env.mockTokenContracts[1].contract
                .connect(env.impersonatedAccounts[0])
                .transfer(admin.address, BigNumber.from(Amount).mul(BigNumber.from(10).pow(CTDecimals)));
            await env.mockTokenContracts[1].contract
                .connect(admin)
                .transfer(borrower.address, BigNumber.from(Amount).mul(BigNumber.from(10).pow(CTDecimals)));
            await env.mockTokenContracts[1].contract
                .connect(borrower)
                .approve(poolAddress, BigNumber.from(Amount).mul(BigNumber.from(10).pow(CTDecimals)));

            // console.log("Tokens present!");
            pool = await createNewPool(env, BorrowAsset, CollateralAsset, iyield, salt, false, {
                _poolSize: BigNumber.from(100).mul(BigNumber.from(10).pow(BTDecimals)),
                _volatilityThreshold: BigNumber.from(20).mul(BigNumber.from(10).pow(28)),
                _borrowRate: BigNumber.from(1).mul(BigNumber.from(10).pow(28)),
                _collateralAmount: BigNumber.from(Amount).mul(BigNumber.from(10).pow(CTDecimals)),
                // _collateralAmount: BigNumber.from(1).mul(BigNumber.from(10).pow(CTDecimals)),
                _collateralRatio: BigNumber.from(250).mul(BigNumber.from(10).pow(28)),
                _collectionPeriod: 10000,
                _loanWithdrawalDuration: 200,
                _noOfRepaymentIntervals: 100,
                _repaymentInterval: 1000,
            });

            // console.log({ actualPoolAddress: pool.address });

            let poolTokenAddress = await pool.poolToken(); //Getting the address of the pool token

            poolToken = await deployHelper.pool.getPoolToken(poolTokenAddress);

            expect(await poolToken.name()).eq('Pool Tokens');
            expect(await poolToken.symbol()).eq('OBPT');
            expect(await poolToken.decimals()).eq(18);

            assert.equal(poolAddress, pool.address, 'Generated and Actual pool address should match');
        });

        it('CreditLine Request: Borrower and Lender cannot be same', async function () {
            let { admin, borrower, lender } = env.entities;
            let borrowLimit: BigNumber = BigNumber.from('10').mul('1000000000000000000'); // 10e18
            let _liquidationThreshold: BigNumberish = BigNumber.from(100);
            let _borrowRate: BigNumberish = BigNumber.from(1).mul(BigNumber.from('10').pow(28));
            let _autoLiquidation: boolean = true;
            let _collateralRatio: BigNumberish = BigNumber.from(200);
            let _borrowAsset: string = env.mockTokenContracts[0].contract.address;
            let _collateralAsset: string = env.mockTokenContracts[1].contract.address;

            creditLine = env.creditLine;

            await expect(
                creditLine
                .connect(lender)
                .request( 
                    lender.address,
                    borrowLimit,
                    _liquidationThreshold,
                    _borrowRate,
                    _autoLiquidation,
                    _collateralRatio,
                    _borrowAsset,
                    _collateralAsset,
                    true
                )
            ).to.be.revertedWith('Lender and Borrower cannot be same addresses');
        });

        it('CreditLine Request: Should revert if price oracle does not exist', async function () {
            let { admin, borrower, lender } = env.entities;
            let borrowLimit: BigNumber = BigNumber.from('10').mul('1000000000000000000'); // 10e18
            let _liquidationThreshold: BigNumberish = BigNumber.from(100);
            let _borrowRate: BigNumberish = BigNumber.from(1).mul(BigNumber.from('10').pow(28));
            let _autoLiquidation: boolean = true;
            let _collateralRatio: BigNumberish = BigNumber.from(200);
            let _borrowAsset: string = env.mockTokenContracts[0].contract.address;
            let _collateralAsset: string = env.mockTokenContracts[1].contract.address;

            creditLine = env.creditLine;

            await expect(
                creditLine
                .connect(lender)
                .request( 
                    borrower.address,
                    borrowLimit,
                    _liquidationThreshold,
                    _borrowRate,
                    _autoLiquidation,
                    _collateralRatio,
                    Contracts.BAT, // Using a different borrow token
                    _collateralAsset,
                    true
                )
            ).to.be.revertedWith('CL: No price feed');
        });

        it('CreditLine Request: Should revert if collateral ratio is less than liquidation threshold', async function () {
            let { admin, borrower, lender } = env.entities;
            let borrowLimit: BigNumber = BigNumber.from('10').mul('1000000000000000000'); // 10e18
            let _liquidationThreshold: BigNumberish = BigNumber.from(100);
            let _borrowRate: BigNumberish = BigNumber.from(1).mul(BigNumber.from('10').pow(28));
            let _autoLiquidation: boolean = true;
            let _collateralRatio: BigNumberish = BigNumber.from(50);
            let _borrowAsset: string = env.mockTokenContracts[0].contract.address;
            let _collateralAsset: string = env.mockTokenContracts[1].contract.address;

            creditLine = env.creditLine;

            await expect(
                creditLine
                .connect(lender)
                .request( 
                    borrower.address,
                    borrowLimit,
                    _liquidationThreshold,
                    _borrowRate,
                    _autoLiquidation,
                    _collateralRatio,
                    _borrowAsset,
                    _collateralAsset,
                    true
                )
            ).to.be.revertedWith('CL: collateral ratio should be higher');
        });

        it('Creditline Request: Check for correct request', async function () {
            let { admin, borrower, lender } = env.entities;
            let borrowLimit: BigNumber = BigNumber.from('10').mul('1000000000000000000'); // 10e18
            let _liquidationThreshold: BigNumberish = BigNumber.from(100);
            let _borrowRate: BigNumberish = BigNumber.from(1).mul(BigNumber.from('10').pow(28));
            let _autoLiquidation: boolean = true;
            let _collateralRatio: BigNumberish = BigNumber.from(200);
            let _borrowAsset: string = env.mockTokenContracts[0].contract.address;
            let _collateralAsset: string = env.mockTokenContracts[1].contract.address;

            creditLine = env.creditLine;

            let values = await creditLine
                .connect(lender)
                .callStatic.request(
                    borrower.address,
                    borrowLimit,
                    _liquidationThreshold,
                    _borrowRate,
                    _autoLiquidation,
                    _collateralRatio,
                    _borrowAsset,
                    _collateralAsset,
                    true
                );
            
                await expect(
                    creditLine
                        .connect(lender)
                        .request(
                            borrower.address,
                            borrowLimit,
                            _liquidationThreshold,
                            _borrowRate,
                            _autoLiquidation,
                            _collateralRatio,
                            _borrowAsset,
                            _collateralAsset,
                            true
                        )
                )
                    .to.emit(creditLine, 'CreditLineRequested')
                    .withArgs(values, lender.address, borrower.address);

            let StatusActual = (await creditLine.connect(admin).creditLineVariables(values)).status;
            assert(
                StatusActual.toString() == BigNumber.from('1').toString(),
                `Creditline should be in requested Stage. Expected: ${BigNumber.from('0').toString()} 
                Actual: ${StatusActual}`
            );
        });
    });
}
