import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import {
    AaveYieldParams,
    CompoundPair,
    CreditLineInitParams,
    DeploymentParams,
    ExtensionInitParams,
    PoolFactoryInitParams,
    PriceOracleSource,
    RepaymentsInitParams,
    StrategyRegistryParams,
    YearnPair,
} from '../../utils/types';

import { createSavingsAccount, initSavingsAccount } from '../../utils/createEnv/savingsAccount';
import { createStrategyRegistry, initStrategyRegistry } from '../../utils/createEnv/strategyRegistry';
import { createCreditLines, initCreditLine } from '../../utils/createEnv/creditLines';
import { createAaveYieldWithInit, createCompoundYieldWithInit, createYearnYieldWithInit } from '../../utils/createEnv/yields';
import { createAdminVerifierWithInit, createVerificationWithInit } from '../../utils/createEnv/verification';
import { createPriceOracle, setPriceOracleFeeds } from '../../utils/createEnv/priceOracle';
import { addSupportedTokens, createPoolFactory, initPoolFactory, setImplementations } from '../../utils/createEnv/poolFactory';
import { createExtenstionWithInit } from '../../utils/createEnv/extension';
import { createRepaymentsWithInit } from '../../utils/createEnv/repayments';
import { createPool } from '../../utils/createEnv/poolLogic';
import { createPoolToken } from '../../utils/createEnv/poolToken';

import { SavingsAccount } from '../../typechain/SavingsAccount';
import { StrategyRegistry } from '../../typechain/StrategyRegistry';
import { AaveYield } from '../../typechain/AaveYield';
import { YearnYield } from '../../typechain/YearnYield';
import { CompoundYield } from '../../typechain/CompoundYield';
import { Pool } from '../../typechain/Pool';
import { Verification } from '../../typechain/Verification';
import { PoolFactory } from '../../typechain/PoolFactory';
import { PriceOracle } from '../../typechain/PriceOracle';
import { Extension } from '../../typechain/Extension';
import { PoolToken } from '../../typechain/PoolToken';
import { Repayments } from '../../typechain/Repayments';
import { AdminVerifier } from '../../typechain/AdminVerifier';
import { CreditLine } from '../../typechain/CreditLine';
import { IYield } from '../../typechain/IYield';
import { zeroAddress } from '../../utils/constants';
import { IYield__factory } from '../../typechain/factories/IYield__factory';
import { YearnYield__factory } from '../../typechain/factories/YearnYield__factory';

export async function deployer(signers: SignerWithAddress[], config: DeploymentParams) {
    const {
        strategyRegistryParams,
        aaveYieldParams,
        yearnYieldPairs,
        compoundPairs,
        priceFeeds,
        extensionInitParams,
        repaymentsInitParams,
        poolFactoryInitParams,
        // creditLineInitParams
    } = config;
    let [proxyAdmin, admin, deployer]: SignerWithAddress[] = signers;

    console.log('Deploying savings account');

    const savingsAccount: SavingsAccount = await createSavingsAccount(proxyAdmin);

    console.log('Deploying Strategy Registry');

    const strategyRegistry: StrategyRegistry = await createStrategyRegistry(proxyAdmin);

    console.log('Deploying credit line');

    const creditLine: CreditLine = await createCreditLines(proxyAdmin);

    console.log('initialize savings account');

    await initSavingsAccount(savingsAccount, admin, strategyRegistry, creditLine.address);

    console.log('Initialize strategy registry');

    await initStrategyRegistry(strategyRegistry, deployer, admin.address, strategyRegistryParams.maxStrategies);

    await (await strategyRegistry.connect(admin).addStrategy(zeroAddress)).wait();

    let aaveYield: IYield ;
    if(aaveYieldParams?.wethGateway) {
        console.log('Deploy and initialize aaveYield');

        aaveYield = await createAaveYieldWithInit(proxyAdmin, admin, savingsAccount, aaveYieldParams);
        await (await strategyRegistry.connect(admin).addStrategy(aaveYield.address)).wait();
    } else {
        aaveYield = IYield__factory.connect(zeroAddress, admin);
    }

    let yearnYield: IYield;
    if(yearnYieldPairs && yearnYieldPairs.length != 0) {
        console.log("Deploy and initialize yearnYield");

        yearnYield = await createYearnYieldWithInit(proxyAdmin, admin, savingsAccount, yearnYieldPairs);
        await strategyRegistry.connect(admin).addStrategy(yearnYield.address);
    } else {
        yearnYield = IYield__factory.connect(zeroAddress, admin);
    }

    let compoundYield: IYield;
    if(compoundPairs && compoundPairs?.length != 0) {
        console.log('Deploy and initialize compoundYield');

        compoundYield = await createCompoundYieldWithInit(proxyAdmin, admin, savingsAccount, compoundPairs);
        await (await strategyRegistry.connect(admin).addStrategy(compoundYield.address)).wait();
    } else {
        compoundYield = IYield__factory.connect(zeroAddress, admin);
    }

    console.log('Deploying verification');

    const verification: Verification = await createVerificationWithInit(proxyAdmin, admin);
    const adminVerifier: AdminVerifier = await createAdminVerifierWithInit(proxyAdmin, admin, verification);
    await (await verification.connect(admin).addVerifier(adminVerifier.address)).wait();

    console.log('Deploying price oracle');

    const priceOracle: PriceOracle = await createPriceOracle(proxyAdmin, admin);

    console.log('setting price feeds');

    await setPriceOracleFeeds(priceOracle, admin, priceFeeds);

    console.log('Deploy and initialize pool factory');

    const poolFactory: PoolFactory = await createPoolFactory(proxyAdmin);

    await initPoolFactory(poolFactory, admin, {
        ...poolFactoryInitParams,
        admin: admin.address,
    });

    console.log('Deploying extenstions');

    const extension: Extension = await createExtenstionWithInit(proxyAdmin, admin, poolFactory, extensionInitParams);

    console.log('Deploying pool logic');

    const poolLogic: Pool = await createPool(proxyAdmin);

    console.log('Deploying pool token logic');

    const poolTokenLogic: PoolToken = await createPoolToken(proxyAdmin);

    console.log('Deploying repayment logic');

    const repaymentLogic: Repayments = await createRepaymentsWithInit(proxyAdmin, admin, poolFactory, savingsAccount, repaymentsInitParams);

    console.log('Set implementations in Pool Factory');

    await setImplementations(
        poolFactory,
        admin,
        poolLogic,
        repaymentLogic,
        poolTokenLogic,
        verification,
        strategyRegistry,
        priceOracle,
        savingsAccount,
        extension
    );

    console.log('set supported borrow and collateral tokens');

    await addSupportedTokens(
        poolFactory,
        admin,
        // [...compoundPairs, ...yearnYieldPairs].map((a) => a.asset),
        // [...compoundPairs, ...yearnYieldPairs].map((a) => a.asset)
        compoundPairs.map((a) => a.asset),
        compoundPairs.map((a) => a.asset)
    );

    console.log('initialize credit lines');
    // TODO
    // await initCreditLine(creditLine, admin, );

    return {
        savingsAccount: savingsAccount.address,
        strategyRegistry: strategyRegistry.address,
        creditLines: creditLine.address,
        proxyAdmin: proxyAdmin.address,
        admin: admin.address,
        aaveYield: aaveYield ? aaveYield.address : 'Contract not deployed in this network',
        yearnYield: yearnYield ? yearnYield.address : 'Contract not deployed in this network',
        compoundYield: compoundYield ? compoundYield.address : 'Contract not deployed in this network',
        verification: verification.address,
        adminVerifier: adminVerifier.address,
        priceOracle: priceOracle.address,
        extension: extension.address,
        poolLogic: poolLogic.address,
        poolTokenLogic: poolTokenLogic.address,
        repaymentLogic: repaymentLogic.address,
        poolFactory: poolFactory.address,
    };
}
