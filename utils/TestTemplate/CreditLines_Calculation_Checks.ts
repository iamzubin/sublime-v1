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
} from '../constants';

import DeployHelper from '../deploys';
import { ERC20 } from '../../typechain/ERC20';
import { sha256 } from '@ethersproject/sha2';
import { BigNumber, BigNumberish } from 'ethers';
import { IYield } from '@typechain/IYield';
import { Address } from 'hardhat-deploy/dist/types';
import { Pool } from '@typechain/Pool';
import { CompoundYield } from '@typechain/CompoundYield';
import { getPoolInitSigHash } from '../createEnv/poolLogic';
import { CreditLine } from '../../typechain/CreditLine';
import { Contracts } from '../../existingContracts/compound.json';
import { expectApproxEqual } from '../helpers';
import { incrementChain, timeTravel, blockTravel } from '../time';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { ERC20Detailed } from '@typechain/ERC20Detailed';
import { SavingsAccount } from '@typechain/SavingsAccount';

export async function CreditLines_Calculations(
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
    const hre = require('hardhat');
    const { ethers, network } = hre;
    let snapshotId: any;

    describe(`CreditLines ${BorrowToken}/${CollateralToken}: Requesting credit lines`, async () => {
        let env: Environment;
        let pool: Pool;
        let poolAddress: Address;

        let deployHelper: DeployHelper;
        let BorrowAsset: ERC20;
        let CollateralAsset: ERC20;
        let iyield: IYield;
        let creditLine: CreditLine;
        let Compound: CompoundYield;

        let borrowLimit: BigNumber;
        let _borrowRate: BigNumberish;
        let _autoLiquidation: boolean;
        let _collateralRatio: BigNumberish;
        let _borrowAsset: string;
        let _collateralAsset: string;
        let values: BigNumber;

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
                    _poolInitFuncSelector: getPoolInitSigHash(),
                    _liquidatorRewardFraction: testPoolFactoryParams._liquidatorRewardFraction,
                    _poolCancelPenalityFraction: testPoolFactoryParams._poolCancelPenalityFraction,
                    _protocolFeeFraction: testPoolFactoryParams._protocolFeeFraction,
                    protocolFeeCollector: '',
                    _minBorrowFraction: testPoolFactoryParams._minborrowFraction,
                    noStrategy: '',
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
            assert.equal(poolAddress, pool.address, 'Generated and Actual pool address should match');

            borrowLimit = BigNumber.from('10').mul('1000000000000000000'); // 10e18
            _borrowRate = BigNumber.from(1).mul(BigNumber.from('10').pow(28));
            _autoLiquidation = true;
            _collateralRatio = BigNumber.from(200).mul(BigNumber.from(10).pow(28));
            _borrowAsset = env.mockTokenContracts[0].contract.address;
            _collateralAsset = env.mockTokenContracts[1].contract.address;

            creditLine = env.creditLine;

            values = await creditLine
                .connect(lender)
                .callStatic.request(
                    borrower.address,
                    borrowLimit,
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

            await expect(creditLine.connect(lender).accept(values)).to.be.revertedWith(
                "Only Borrower or Lender who hasn't requested can accept"
            );

            await expect(creditLine.connect(borrower).accept(values)).to.emit(creditLine, 'CreditLineAccepted').withArgs(values);

            let StatusActual = (await creditLine.connect(admin).creditLineVariables(values)).status;
            assert(
                StatusActual.toString() == BigNumber.from('2').toString(),
                `Creditline should be in requested Stage. Expected: ${BigNumber.from('2').toString()} 
                Actual: ${StatusActual}`
            );
        });

        it('Creditline: calculateInterest', async function () {
            let { admin, borrower, lender } = env.entities;
            let principal = BigNumber.from(10000);
            let borrowRate = BigNumber.from(10).mul(BigNumber.from(10).pow(28));
            let timeElapsed = BigNumber.from(10).mul(86400);

            let result = await creditLine.connect(admin).calculateInterest(principal, borrowRate,timeElapsed);
            console.log(result.toString());

            await timeTravel(network, 86400 * 10); // travelling by 10 days

            let interest = await creditLine.connect(admin).calculateInterestAccrued(values);
            console.log(interest.toString());
        });
    });
}