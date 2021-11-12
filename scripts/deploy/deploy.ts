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
import {
    createAaveYieldWithInit,
    createCompoundYieldWithInit,
    createYearnYieldWithInit,
    createNoYieldWithInit,
} from '../../utils/createEnv/yields';
import { createAdminVerifierWithInit, createVerificationWithInit } from '../../utils/createEnv/verification';
import { createPriceOracle, setPriceOracleFeeds } from '../../utils/createEnv/priceOracle';
import { addSupportedTokens, createPoolFactory, initPoolFactory, setImplementations } from '../../utils/createEnv/poolFactory';
import { createExtenstionWithInit } from '../../utils/createEnv/extension';
import { createRepaymentsWithInit } from '../../utils/createEnv/repayments';
import { createPool } from '../../utils/createEnv/poolLogic';

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

    console.log('Deploy and initialize noYield');

    const noYield: IYield = await createNoYieldWithInit(proxyAdmin, admin, savingsAccount);
    await (await strategyRegistry.connect(admin).addStrategy(noYield.address)).wait();

    let aaveYield: IYield;
    if (aaveYieldParams?.wethGateway) {
        console.log('Deploy and initialize aaveYield');

        aaveYield = await createAaveYieldWithInit(proxyAdmin, admin, savingsAccount, aaveYieldParams);
        await (await strategyRegistry.connect(admin).addStrategy(aaveYield.address)).wait();
    } else {
        aaveYield = IYield__factory.connect(zeroAddress, admin);
    }

    let yearnYield: IYield;
    if (yearnYieldPairs && yearnYieldPairs.length != 0) {
        console.log('Deploy and initialize yearnYield');

        yearnYield = await createYearnYieldWithInit(proxyAdmin, admin, savingsAccount, yearnYieldPairs);
        await (await strategyRegistry.connect(admin).addStrategy(yearnYield.address)).wait();
    } else {
        yearnYield = IYield__factory.connect(zeroAddress, admin);
    }

    let compoundYield: IYield;
    if (compoundPairs && compoundPairs?.length != 0) {
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

    console.log('Deploying repayment logic');

    const repaymentLogic: Repayments = await createRepaymentsWithInit(proxyAdmin, admin, poolFactory, savingsAccount, repaymentsInitParams);

    console.log('Set implementations in Pool Factory');

    await setImplementations(
        poolFactory,
        admin,
        poolLogic,
        repaymentLogic,
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
    await initCreditLine(
        creditLine,
        admin,
        noYield.address,
        priceOracle,
        savingsAccount,
        strategyRegistry,
        {
            _protocolFeeFraction: '1750000000000000000000000000',
            _liquidatorRewardFraction: '92000000000000000000000000000',
        },
        admin
    );

    return {
        savingsAccount: savingsAccount.address,
        strategyRegistry: strategyRegistry.address,
        creditLines: creditLine.address,
        proxyAdmin: proxyAdmin.address,
        admin: admin.address,
        noYield: noYield ? noYield.address : 'Contract not deplyed in this network',
        aaveYield: aaveYield ? aaveYield.address : 'Contract not deployed in this network',
        yearnYield: yearnYield ? yearnYield.address : 'Contract not deployed in this network',
        compoundYield: compoundYield ? compoundYield.address : 'Contract not deployed in this network',
        verification: verification.address,
        adminVerifier: adminVerifier.address,
        priceOracle: priceOracle.address,
        extension: extension.address,
        poolLogic: poolLogic.address,
        repaymentLogic: repaymentLogic.address,
        poolFactory: poolFactory.address,
    };
}

// {
//     "savingsAccount": "0x3a495b65EFbB4Db0BE408C862ca8d33d9703209c",
//     "strategyRegistry": "0x9Af5CaF81b9985cB691f7763b7bE0412bb05b3dC",
//     "creditLines": "0xD077B6d3ed11d0aDD036D7d9b1Ac9d4FdE561fF4",
//     "proxyAdmin": "0x03f484190bc6889B28739Af182D996df57B02CC9",
//     "admin": "0x4813CB98f2322CFb9fbf2f2dAFe01297FD70D19e",
//     "noYield": "0x4EB3d11dC0ffD11fEBb379413840371b66384B4B",
//     "aaveYield": "0xf15bB845dFDeDB72c4E7c31356f03C46b64fcE60",
//     "yearnYield": "0x0000000000000000000000000000000000000000",
//     "compoundYield": "0x90a17f297CC6e85CA67251e7B4A888F9de16b192",
//     "verification": "0x19c388671f9B773fcBad80009e20eEE470F1AD26",
//     "adminVerifier": "0x6c906de6bcb1e3bFAd75F049e6C4F6f4DAC7043E",
//     "priceOracle": "0xeD24708d93576ca2296BE201a5e105ECAF2f6F2f",
//     "extension": "0xe493BA7Bee4468b8FBA61256E457A098Aa7cCA17",
//     "poolLogic": "0x0f5E1f09Ff37a4f2F68939cEb1A3a151Fa0AB418",
//     "repaymentLogic": "0x71E925ad07dA7542855d89a52bf6d139349F9b33",
//     "poolFactory": "0xa50E7C3444844Ef6773f3181f0a1f42B6321b677"
//   }
