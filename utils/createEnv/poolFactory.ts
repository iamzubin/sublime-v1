import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';

import DeployHelper from '../deploys';

import { PoolFactory } from '@typechain/PoolFactory';
import { SublimeProxy } from '@typechain/SublimeProxy';
import { Address } from 'hardhat-deploy/dist/types';
import { Pool } from '@typechain/Pool';
import { Repayments } from '@typechain/Repayments';
import { PoolToken } from '@typechain/PoolToken';
import { Verification } from '@typechain/Verification';
import { StrategyRegistry } from '@typechain/StrategyRegistry';
import { PriceOracle } from '@typechain/PriceOracle';
import { SavingsAccount } from '@typechain/SavingsAccount';
import { Extension } from '@typechain/Extension';
import { PoolFactoryInitParams } from '@utils/types';
import { zeroAddress } from '../../utils/constants';

export async function createPoolFactory(proxyAdmin: SignerWithAddress): Promise<PoolFactory> {
    let deployHelper: DeployHelper = new DeployHelper(proxyAdmin);
    let poolFactoryLogic: PoolFactory = await deployHelper.pool.deployPoolFactory();
    let poolFactoryProxy: SublimeProxy = await deployHelper.helper.deploySublimeProxy(poolFactoryLogic.address, proxyAdmin.address);
    let poolFactory: PoolFactory = await deployHelper.pool.getPoolFactory(poolFactoryProxy.address);
    return poolFactory;
}

export async function initPoolFactory(poolFactory: PoolFactory, signer: SignerWithAddress, initParams: PoolFactoryInitParams) {
    let {
        admin,
        _collectionPeriod,
        _matchCollateralRatioInterval,
        _marginCallDuration,
        _gracePeriodPenaltyFraction,
        _poolInitFuncSelector,
        _poolTokenInitFuncSelector,
        _liquidatorRewardFraction,
        _poolCancelPenalityFraction,
        _protocolFeeFraction,
        protocolFeeCollector,
    } = initParams;
    await poolFactory
        .connect(signer)
        .initialize(
            admin,
            _collectionPeriod,
            _matchCollateralRatioInterval,
            _marginCallDuration,
            _gracePeriodPenaltyFraction,
            _poolInitFuncSelector,
            _poolTokenInitFuncSelector,
            _liquidatorRewardFraction,
            _poolCancelPenalityFraction,
            _protocolFeeFraction,
            protocolFeeCollector
        );
}

export async function addSupportedTokens(
    poolFactory: PoolFactory,
    admin: SignerWithAddress,
    collateralTokens: Address[],
    borrowTokens: Address[]
) {
    for (let index = 0; index < collateralTokens.length; index++) {
        const col = collateralTokens[index];
        await poolFactory.connect(admin).updateSupportedCollateralTokens(col, true);
    }
    for (let index = 0; index < borrowTokens.length; index++) {
        const bor = borrowTokens[index];
        await poolFactory.connect(admin).updateSupportedBorrowTokens(bor, true);
    }
    await poolFactory.connect(admin).updateSupportedCollateralTokens(zeroAddress, true);
    await poolFactory.connect(admin).updateSupportedBorrowTokens(zeroAddress, true);
}

export async function setImplementations(
    poolFactory: PoolFactory,
    admin: SignerWithAddress,
    poolLogic: Pool,
    repayments: Repayments,
    poolTokenLogic: PoolToken,
    verification: Verification,
    strategyRegistry: StrategyRegistry,
    priceOracle: PriceOracle,
    savingsAccount: SavingsAccount,
    extension: Extension
) {
    await poolFactory
        .connect(admin)
        .setImplementations(
            poolLogic.address,
            repayments.address,
            poolTokenLogic.address,
            verification.address,
            strategyRegistry.address,
            priceOracle.address,
            savingsAccount.address,
            extension.address
        );
}
