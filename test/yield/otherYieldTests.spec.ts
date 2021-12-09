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
} from '../../utils/types';

import DeployHelper from '../../utils/deploys';

import { createEnvironment } from '../../utils/createEnv';
import { getPoolInitSigHash } from '../../utils/createEnv/poolLogic';

import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { NoYield } from '../../typechain/NoYield';
import { YearnYield } from '../../typechain/YearnYield';

import { Contracts } from '../../existingContracts/compound.json';
import { zeroAddress } from '../../utils/constants';
import { DAI_Yearn_Protocol_Address, ETH_Yearn_Protocol_Address } from '../../utils/constants-rahul';
import { CompoundYield } from '../../typechain/CompoundYield';

describe('Other Yield Tests', async () => {
    let env: Environment;
    let noYield: NoYield;
    let yearnYield: YearnYield;
    let compoundYield: CompoundYield;
    let user: SignerWithAddress;
    let randomUser: SignerWithAddress;
    before(async () => {
        env = await createEnvironment(
            hre,
            [],
            [
                { asset: Contracts.USDT, liquidityToken: Contracts.cUSDT },
                { asset: zeroAddress, liquidityToken: Contracts.cETH },
            ] as CompoundPair[],
            [
                { asset: Contracts.DAI, liquidityToken: DAI_Yearn_Protocol_Address },
                { asset: zeroAddress, liquidityToken: ETH_Yearn_Protocol_Address },
            ] as YearnPair[],
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
        user = env.entities.admin;
        randomUser = env.entities.borrower;
        const deployHelper = new DeployHelper(user);
        noYield = await deployHelper.core.getNoYield(env.yields.noYield.address);
        yearnYield = await deployHelper.core.getYearnYield(env.yields.yearnYield.address);
        compoundYield = await deployHelper.core.getCompoundYield(env.yields.compoundYield.address);
    });

    it('Should throw error if random user updated saving account', async () => {
        await expect(noYield.connect(randomUser).updateSavingsAccount(randomUser.address)).to.be.revertedWith(
            'Ownable: caller is not the owner'
        );
    });

    it('Should update savings account', async () => {
        await expect(noYield.connect(user).updateSavingsAccount(user.address)).to.emit(noYield, 'SavingsAccountUpdated');
    });

    it('Emergency withdraw should fetch all tokens', async () => {
        // more tests to be followed
        await noYield.connect(user).emergencyWithdraw(Contracts.USDT, user.address);
    });

    it('Emergency withdraw Token from yearn yield', async () => {
        await yearnYield.connect(user).emergencyWithdraw(Contracts.DAI, user.address);
    });

    it('Emergency withdraw ETH from yearn yield', async () => {
        await yearnYield.connect(user).emergencyWithdraw(zeroAddress, user.address);
    });

    it('Emergency withdraw ETH from compound yield', async () => {
        await compoundYield.connect(user).emergencyWithdraw(zeroAddress, user.address);
    });

    it('Emergency withdraw Tokens from compound yield', async () => {
        await compoundYield.connect(user).emergencyWithdraw(Contracts.USDT, user.address);
    });
});
