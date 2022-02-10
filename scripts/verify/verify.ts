import hre from 'hardhat';
import { getAddressesToVerify } from './populateLogicAddresses';
import { contractsToVerify, helperContractsToVerify, supportingContracts, contractAddresses } from './contractsToVerify';

async function verifyProxy(contracts: any) {
    let [proxyAdmin] = await hre.ethers.getSigners();

    console.log(`Verifying contracts on network ${hre.network.name}`);

    console.log(`Verifying strategy proxy ${contracts.strategyRegistry.proxy}`);
    await hre
        .run('verify:verify', {
            address: contracts.strategyRegistry.proxy,
            constructorArguments: [contracts.strategyRegistry.logic, proxyAdmin.address, Buffer.from('')],
            contract: 'contracts/SublimeProxy.sol:SublimeProxy',
        })
        .catch(console.log);

    // you don't need to verify all proxies. If needed, just copy the code snippet above
    return 'Proxy Verified';
}

async function verifyLogic(contracts: any) {
    console.log('Verify admin verifier Logic');
    await hre
        .run('verify:verify', {
            address: contracts.adminVerifier.logic,
            constructorArguments: [],
            contract: 'contracts/Verification/adminVerifier.sol:AdminVerifier',
        })
        .catch(console.log);

    console.log(`Verifying strategy logic ${contracts.strategyRegistry.logic}`);
    await hre
        .run('verify:verify', {
            address: contracts.strategyRegistry.logic,
            constructorArguments: [],
            contract: 'contracts/yield/StrategyRegistry.sol:StrategyRegistry',
        })
        .catch(console.log);

    console.log(`Verifying credit lines logic ${contracts.creditLines.logic}`);
    await hre
        .run('verify:verify', {
            address: contracts.creditLines.logic,
            constructorArguments: [],
            contract: 'contracts/CreditLine/CreditLine.sol:CreditLine',
        })
        .catch(console.log);

    console.log(`Verifying savings account logic ${contracts.savingsAccount.logic}`);
    await hre
        .run('verify:verify', {
            address: contracts.savingsAccount.logic,
            constructorArguments: [],
            contract: 'contracts/SavingsAccount/SavingsAccount.sol:SavingsAccount',
        })
        .catch(console.log);

    console.log(`Verifying aave yield logic ${contracts.aaveYield.logic}`);
    await hre
        .run('verify:verify', {
            address: contracts.aaveYield.logic,
            constructorArguments: [supportingContracts.weth],
            contract: 'contracts/yield/AaveYield.sol:AaveYield',
        })
        .catch(console.log);

    console.log(`Verifying no yield logic ${contracts.noYield.logic}`);
    await hre
        .run('verify:verify', {
            address: contracts.noYield.logic,
            constructorArguments: [],
            contract: 'contracts/yield/NoYield.sol:NoYield',
        })
        .catch(console.log);

    console.log(`Verifying compound yield logic ${contracts.compoundYield.logic}`);
    await hre
        .run('verify:verify', {
            address: contracts.compoundYield.logic,
            constructorArguments: [supportingContracts.weth],
            contract: 'contracts/yield/CompoundYield.sol:CompoundYield',
        })
        .catch(console.log);

    console.log(`Verifying price oracle logic ${contracts.priceOracle.logic}`);
    await hre
        .run('verify:verify', {
            address: contracts.priceOracle.logic,
            constructorArguments: [],
            contract: 'contracts/PriceOracle.sol:PriceOracle',
        })
        .catch(console.log);

    console.log(`Verifying verification logic ${contracts.verification.logic}`);
    await hre
        .run('verify:verify', {
            address: contracts.verification.logic,
            constructorArguments: [],
            contract: 'contracts/Verification/Verification.sol:Verification',
        })
        .catch(console.log);

    console.log(`Verifying pool factory logic ${contracts.poolFactory.logic}`);
    await hre
        .run('verify:verify', {
            address: contracts.poolFactory.logic,
            constructorArguments: [contractAddresses.usdc],
            contract: 'contracts/Pool/PoolFactory.sol:PoolFactory',
        })
        .catch(console.log);

    console.log(`Verifying repayments logic ${contracts.repayments.logic}`);
    await hre
        .run('verify:verify', {
            address: contracts.repayments.logic,
            constructorArguments: [],
            contract: 'contracts/Pool/Repayments.sol:Repayments',
        })
        .catch(console.log);

    console.log(`Verifying extenstions logic ${contracts.extension.logic}`);
    await hre
        .run('verify:verify', {
            address: contracts.extension.logic,
            constructorArguments: [],
            contract: 'contracts/Pool/Extension.sol:Extension',
        })
        .catch(console.log);

    console.log(`Verifying pool logic ${contracts.pool.proxy}`);
    await hre
        .run('verify:verify', {
            address: contracts.pool.proxy,
            constructorArguments: [
                contractAddresses.priceOracle,
                contractAddresses.savingsAccount,
                contractAddresses.extension,
                contractAddresses.repaymentLogic,
            ],
            contract: 'contracts/Pool/Pool.sol:Pool',
        })
        .catch(console.log);

    console.log('Verify savings account eth utils');
    await hre.run('verify:verify', {
        address: helperContractsToVerify.SavingsAccountEthUtils,
        constructorArguments: [supportingContracts.weth, supportingContracts.savingsAccount],
        contract: 'contracts/SavingsAccount/SavingsAccountEthUtils.sol:SavingsAccountEthUtils',
    });

    console.log('Verify credit line utils');
    await hre.run('verify:verify', {
        address: helperContractsToVerify.CreditLineUtils,
        constructorArguments: [supportingContracts.weth, supportingContracts.creditLines],
        contract: 'contracts/CreditLine/CreditLineUtils.sol:CreditLineUtils',
    });

    console.log('Verify Pool utils');
    await hre.run('verify:verify', {
        address: helperContractsToVerify.PoolUtils,
        constructorArguments: [supportingContracts.weth, supportingContracts.bin],
        contract: 'contracts/Pool/PoolUtils.sol:PoolUtils',
    });

    console.log('Verify beacon');
    await hre.run('verify:verify', {
        address: helperContractsToVerify.beacon,
        constructorArguments: [supportingContracts.owner, supportingContracts.poolLogic],
        contract: 'contracts/Pool/Beacon.sol:Beacon',
    });

    console.log('Verify Beacon Proxy');
    await hre.run('verify:verify', {
        address: helperContractsToVerify.minimumBeaconProxy,
        constructorArguments: [helperContractsToVerify.beacon],
        contract: 'contracts/Pool/MinimumBeaconProxy2.sol:MinimumBeaconProxy',
    });
    return 'Logic Verified';
}

async function verify() {
    let contracts = await getAddressesToVerify();
    await verifyProxy(contracts);
    await verifyLogic(contracts);
    return 'All Verified';
}

verify().then(console.log).catch(console.log);
