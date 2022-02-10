import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';

import DeployHelper from '../deploys';

import { PoolFactory } from '@typechain/PoolFactory';
import { SublimeProxy } from '@typechain/SublimeProxy';
import { Address } from 'hardhat-deploy/dist/types';
import { Pool } from '@typechain/Pool';
import { Repayments } from '@typechain/Repayments';
import { Verification } from '@typechain/Verification';
import { StrategyRegistry } from '@typechain/StrategyRegistry';
import { PriceOracle } from '@typechain/PriceOracle';
import { SavingsAccount } from '@typechain/SavingsAccount';
import { Extension } from '@typechain/Extension';
import { PoolFactoryInitParams } from '../../utils/types';
import { zeroAddress } from '../../config/constants';
import { Beacon } from '@typechain/Beacon';

export async function createBeacon(proxyAdmin: SignerWithAddress, owner: Address, implementation: Address): Promise<Beacon> {
    let deployHelper: DeployHelper = new DeployHelper(proxyAdmin);
    let beacon: Beacon = await deployHelper.helper.deployBeacon(owner, implementation);
    return beacon;
}

export async function createPoolFactory(proxyAdmin: SignerWithAddress, usdc: Address): Promise<PoolFactory> {
    let deployHelper: DeployHelper = new DeployHelper(proxyAdmin);
    let poolFactoryLogic: PoolFactory = await deployHelper.pool.deployPoolFactory(usdc);
    let poolFactoryProxy: SublimeProxy = await deployHelper.helper.deploySublimeProxy(poolFactoryLogic.address, proxyAdmin.address);
    let poolFactory: PoolFactory = await deployHelper.pool.getPoolFactory(poolFactoryProxy.address);
    return poolFactory;
}

export async function initPoolFactory(poolFactory: PoolFactory, signer: SignerWithAddress, initParams: PoolFactoryInitParams) {
    let {
        admin,
        _collectionPeriod,
        _loanWithdrawalDuration,
        _marginCallDuration,
        _liquidatorRewardFraction,
        _poolCancelPenalityFraction,
        _minBorrowFraction,
        _protocolFeeFraction,
        protocolFeeCollector,
        noStrategy,
        beacon,
    } = initParams;
    await (
        await poolFactory
            .connect(signer)
            .initialize(
                admin,
                _collectionPeriod,
                _loanWithdrawalDuration,
                _marginCallDuration,
                _liquidatorRewardFraction,
                _poolCancelPenalityFraction,
                _minBorrowFraction,
                _protocolFeeFraction,
                protocolFeeCollector,
                noStrategy,
                beacon
            )
    ).wait();
}

export async function addSupportedTokens(
    poolFactory: PoolFactory,
    admin: SignerWithAddress,
    collateralTokens: Address[],
    borrowTokens: Address[]
) {
    for (let index = 0; index < collateralTokens.length; index++) {
        const col = collateralTokens[index];
        await (await poolFactory.connect(admin).updateSupportedCollateralTokens(col, true)).wait();
    }
    for (let index = 0; index < borrowTokens.length; index++) {
        const bor = borrowTokens[index];
        await (await poolFactory.connect(admin).updateSupportedBorrowTokens(bor, true)).wait();
    }
}

export async function setImplementations(
    poolFactory: PoolFactory,
    admin: SignerWithAddress,
    repayments: Repayments,
    verification: Verification,
    strategyRegistry: StrategyRegistry,
    priceOracle: PriceOracle,
    savingsAccount: SavingsAccount,
    extension: Extension
) {
    await (
        await poolFactory
            .connect(admin)
            .setImplementations(
                repayments.address,
                verification.address,
                strategyRegistry.address,
                priceOracle.address,
                savingsAccount.address,
                extension.address
            )
    ).wait();
}
