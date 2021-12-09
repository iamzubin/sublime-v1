import hre from 'hardhat';
const { ethers, network } = hre;
import { expect, assert } from 'chai';

import {
    Environment,
    CompoundPair,
    YearnPair,
    PriceOracleSource,
    ExtensionInitParams,
    RepaymentsInitParams,
    CreditLineDefaultStrategy,
    PoolFactoryInitParams,
    CreditLineInitParams,
    VerificationParams,
} from '../utils/types';

import DeployHelper from '../utils/deploys';

import { createEnvironment } from '../utils/createEnv';
import { getPoolInitSigHash } from '../utils/createEnv/poolLogic';
import { PoolFactory } from '../typechain/PoolFactory';

import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';

describe('Pool Factory Basic Tests', async () => {
    let env: Environment;
    let poolFactory: PoolFactory;
    let user: SignerWithAddress;

    before(async () => {
        env = await createEnvironment(
            hre,
            [],
            [] as CompoundPair[],
            [] as YearnPair[],
            [] as PriceOracleSource[],
            {
                votingPassRatio: '1000000',
            } as ExtensionInitParams,
            {
                gracePenalityRate: '2388900000000',
                gracePeriodFraction: '100000000000000000',
            } as RepaymentsInitParams,
            {
                admin: '',
                _collectionPeriod: '290238902300000',
                _loanWithdrawalDuration: '238923897444',
                _marginCallDuration: '19028923893934',
                _gracePeriodPenaltyFraction: '278933489765478654',
                _poolInitFuncSelector: getPoolInitSigHash(),
                _liquidatorRewardFraction: '23789237834783478347834',
                _poolCancelPenalityFraction: '237823783247843783487',
                _protocolFeeFraction: '43894895489075489549',
                protocolFeeCollector: '',
                _minBorrowFraction: '3498347893489754984985',
                noStrategy: '',
            } as PoolFactoryInitParams,
            CreditLineDefaultStrategy.Compound,
            {
                _protocolFeeFraction: '378934786347863478',
                _liquidatorRewardFraction: '378945786347868735',
            } as CreditLineInitParams,
            {
                activationDelay: 0,
            } as VerificationParams
        );
        poolFactory = env.poolFactory;
    });

    it('Owner should be able to update the repayment intervals', async () => {
        user = env.entities.admin;
        await expect(poolFactory.connect(user).updateRepaymentIntervalLimit(10, 100)).to.emit(poolFactory, 'LimitsUpdated');
    });

    it('Shoud throw error if any other user tried to update repayment interval', async () => {
        user = env.entities.borrower;
        await expect(poolFactory.connect(user).updateRepaymentIntervalLimit(10, 100)).to.be.revertedWith('as');
    });

    it('Owner should be able to update the number repayment intervals', async () => {
        user = env.entities.admin;
        await expect(poolFactory.connect(user).updateNoOfRepaymentIntervalsLimit(10, 100)).to.emit(poolFactory, 'LimitsUpdated');
    });

    it('Shoud throw error if any other user tried to update number of repayment interval', async () => {
        user = env.entities.borrower;
        await expect(poolFactory.connect(user).updateNoOfRepaymentIntervalsLimit(10, 100)).to.be.revertedWith('as');
    });

    it('Owner should be able to update the ideal col ratio', async () => {
        user = env.entities.admin;
        await expect(poolFactory.connect(user).updateidealCollateralRatioLimit(10, 100)).to.emit(poolFactory, 'LimitsUpdated');
    });

    it('Shoud throw error if any other user tried to update col ratio', async () => {
        user = env.entities.borrower;
        await expect(poolFactory.connect(user).updateidealCollateralRatioLimit(10, 100)).to.be.revertedWith('as');
    });

    it('Owner should be able to update the borrow limit', async () => {
        user = env.entities.admin;
        await expect(poolFactory.connect(user).updateBorrowRateLimit(10, 100)).to.emit(poolFactory, 'LimitsUpdated');
    });

    it('Shoud throw error if any other user tried to update borrow limit', async () => {
        user = env.entities.borrower;
        await expect(poolFactory.connect(user).updateBorrowRateLimit(10, 100)).to.be.revertedWith('as');
    });

    it('Update Protocol fee collector', async () => {
        await expect(poolFactory.connect(env.entities.admin).updateProtocolFeeCollector(env.entities.admin.address)).to.emit(
            poolFactory,
            'ProtocolFeeCollectorUpdated'
        );
    });

    it('Owner should be able to update the pool size', async () => {
        user = env.entities.admin;
        await expect(poolFactory.connect(user).updatePoolSizeLimit('876237862378', '3845863485678346578634')).to.emit(
            poolFactory,
            'LimitsUpdated'
        );
    });
});
