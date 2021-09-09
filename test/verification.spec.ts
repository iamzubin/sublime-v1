import { calculateNewPoolAddress, createEnvironment, createNewPool } from '../utils/createEnv';
import {
    CompoundPair,
    CreditLineDefaultStrategy,
    CreditLineInitParams,
    Environment,
    ExtensionInitParams,
    PoolCreateParams,
    PoolFactoryInitParams,
    PriceOracleSource,
    RepaymentsInitParams,
    YearnPair,
} from '../utils/types';
import hre from 'hardhat';
import { Contracts } from '../existingContracts/compound.json';
import { sha256 } from '@ethersproject/sha2';

import {
    WBTCWhale,
    WhaleAccount,
    Binance7,
    ChainLinkAggregators,
    extensionParams,
    repaymentParams,
    testPoolFactoryParams,
} from '../utils/constants-rahul';

import { zeroAddress } from '../utils/constants';
import { Verification } from '../typechain/Verification';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { expect } from 'chai';

describe('Verification Contracts', async () => {
    let env: Environment;
    let verification: Verification;
    let admin: SignerWithAddress;
    let randomAccount: SignerWithAddress;
    let randomAccount2: SignerWithAddress;

    beforeEach(async () => {
        env = await createEnvironment(
            hre,
            [WBTCWhale, WhaleAccount, Binance7],
            [
                { asset: Contracts.USDT, liquidityToken: Contracts.cUSDT },
                { asset: zeroAddress, liquidityToken: Contracts.cETH },
            ] as CompoundPair[],
            [] as YearnPair[],
            [
                { tokenAddress: zeroAddress, feedAggregator: ChainLinkAggregators['ETH/USD'] },
                { tokenAddress: Contracts.USDT, feedAggregator: ChainLinkAggregators['USDT/USD'] },
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
                _matchCollateralRatioInterval: testPoolFactoryParams._matchCollateralRatioInterval,
                _marginCallDuration: testPoolFactoryParams._marginCallDuration,
                _gracePeriodPenaltyFraction: testPoolFactoryParams._gracePeriodPenaltyFraction,
                _poolInitFuncSelector: testPoolFactoryParams._poolInitFuncSelector,
                _poolTokenInitFuncSelector: testPoolFactoryParams._poolTokenInitFuncSelector,
                _liquidatorRewardFraction: testPoolFactoryParams._liquidatorRewardFraction,
                _poolCancelPenalityFraction: testPoolFactoryParams._poolCancelPenalityFraction,
                _protocolFeeFraction: testPoolFactoryParams._protocolFeeFraction,
                protocolFeeCollector: '',
            } as PoolFactoryInitParams,
            CreditLineDefaultStrategy.Compound,
            { _protocolFeeFraction: testPoolFactoryParams._protocolFeeFraction } as CreditLineInitParams
        );

        verification = env.verification;
        admin = env.entities.admin;
        randomAccount = env.entities.extraLenders[0];
        randomAccount2 = env.entities.extraLenders[1];
    });

    it('Only Owner can register a new user', async () => {
        let userOffchainHash = sha256(Buffer.from('random account 2 details'));

        await expect(verification.connect(randomAccount).registerUser(randomAccount2.address, userOffchainHash)).to.be.revertedWith(
            'Ownable: caller is not the owner'
        );

        await expect(verification.connect(admin).registerUser(randomAccount2.address, userOffchainHash))
            .to.emit(verification, 'UserRegistered')
            .withArgs(randomAccount2.address, userOffchainHash);
    });

    it('Check mapping in view functions', async () => {
        let userOffchainHash = sha256(Buffer.from('random account 2 details'));

        await expect(verification.connect(randomAccount).registerUser(randomAccount2.address, userOffchainHash)).to.be.revertedWith(
            'Ownable: caller is not the owner'
        );

        await expect(verification.connect(admin).registerUser(randomAccount2.address, userOffchainHash))
            .to.emit(verification, 'UserRegistered')
            .withArgs(randomAccount2.address, userOffchainHash);

        // console.log({ isUser: await verification.connect(admin).isUser(randomAccount2.address) });
        expect(await verification.connect(admin).isUser(randomAccount2.address)).eq(true);
        expect(await verification.connect(admin).registeredUsers(randomAccount2.address)).eq(userOffchainHash);
    });

    it('Cannot register user with zero address', async () => {
        let userOffchainHash = sha256(Buffer.from('some account details'));

        await expect(verification.connect(admin).registerUser(zeroAddress, userOffchainHash)).to.be.revertedWith(
            'Verification: Invalid entity address'
        );
    });

    it('Cannot register user with bytes32(0) details', async () => {
        let userOffchainHash = '0x0000000000000000000000000000000000000000000000000000000000000000';

        await expect(verification.connect(admin).registerUser(randomAccount2.address, userOffchainHash)).to.be.revertedWith(
            'Verification: Offchain details should not be empty'
        );
    });

    it('Cannot re-register user that is alreagy registered', async () => {
        let userOffchainHash = sha256(Buffer.from('some account details'));

        await expect(verification.connect(admin).registerUser(randomAccount2.address, userOffchainHash))
            .to.emit(verification, 'UserRegistered')
            .withArgs(randomAccount2.address, userOffchainHash);

        await expect(verification.connect(admin).registerUser(randomAccount2.address, userOffchainHash)).to.be.revertedWith(
            'Verification: User already registered'
        );
    });

    it('Only admin can update existing user details', async () => {
        let userOffchainHash = sha256(Buffer.from('some account details'));
        let newuserOffchainHash = sha256(Buffer.from('new hash data'));

        await expect(verification.connect(admin).registerUser(randomAccount2.address, userOffchainHash))
            .to.emit(verification, 'UserRegistered')
            .withArgs(randomAccount2.address, userOffchainHash);

        await expect(
            verification.connect(randomAccount2).updateUserDetails(randomAccount2.address, newuserOffchainHash)
        ).to.be.revertedWith('Ownable: caller is not the owne');

        await expect(verification.connect(admin).updateUserDetails(randomAccount2.address, newuserOffchainHash))
            .to.emit(verification, 'UserDetailsUpdated')
            .withArgs(randomAccount2.address, newuserOffchainHash);
    });

    it('Only registered user can be unregistered', async () => {
        await expect(verification.connect(admin).unregisterUser(randomAccount2.address)).to.be.revertedWith(
            'Verification: User must be registered'
        );
    });

    it('Only Admin can unregister the user', async () => {
        let userOffchainHash = sha256(Buffer.from('some account details'));

        await expect(verification.connect(admin).registerUser(randomAccount2.address, userOffchainHash))
            .to.emit(verification, 'UserRegistered')
            .withArgs(randomAccount2.address, userOffchainHash);

        await expect(verification.connect(randomAccount2).unregisterUser(randomAccount2.address)).to.be.revertedWith(
            'Ownable: caller is not the owner'
        );

        await expect(verification.connect(admin).unregisterUser(randomAccount2.address))
            .to.emit(verification, 'UserUnregistered')
            .withArgs(randomAccount2.address);
    });
});
