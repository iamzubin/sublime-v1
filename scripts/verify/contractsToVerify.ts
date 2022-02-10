const contractAddresses = {
    savingsAccount: '0x04685dEa32be5Bf7C0224F06AfbEABe05c004d32',
    strategyRegistry: '0x1A44F94625b131f5C2282A8aE2E352A2FAF60f21',
    creditLines: '0x7927eB006c1Dea6a61658c927B276dB1F6c5Ccc9',
    proxyAdmin: '0x03f484190bc6889B28739Af182D996df57B02CC9',
    admin: '0x4813CB98f2322CFb9fbf2f2dAFe01297FD70D19e',
    noYield: '0xbc27ee69efBf33F5E19f431629E49f6837851532',
    aaveYield: '0x716637DC43D82fd0eC57316F50C8A410AA7AaF46',
    yearnYield: '0x0000000000000000000000000000000000000000',
    compoundYield: '0xA3aF03494b6DBcD24a2DaD76FBeCd1C8494bC1a9',
    verification: '0x683FcC905E0AF3D9d60E25Ea93129716FA3a8a01',
    adminVerifier: '0x7fae87c81F10A42513DFe81ec9DdF162F715EA00',
    priceOracle: '0x0Aa2E83eFd3B15501C59cd9763E5660Cc5Ce930E',
    extension: '0x9622C18A48eB3360042d9671B7212B0D17284669',
    poolLogic: '0x7C6Cb81c939D35af67fB5aA1cA3d5122A5B18EeA',
    repaymentLogic: '0xe731d021394Cf19085513A37c8Aa46A3e6143dfe',
    poolFactory: '0x8646D1FD8aa12553680365b235d8c333Fc0f5cC2',
    weth: '0xd0A1E359811322d97991E03f863a0C30C2cF029C',
    usdc: '0xdCFaB8057d08634279f8201b55d311c2a67897D2',
    beacon: '0x2B20C3C850E3dbEDEAAfa55FF2251516a0404427',
    poolUtils: '0xC57FA13E78d1135c5Cd6f746De974491c50e001E',
    creditLineUtils: '0xB3948380e9b2758E541a4d0fFbd50eCF8b62F3B2',
    savingsAccountEthUtils: '0x681766eA83140F1dc3A39447F2e51C1FB226032F',
};

const contractsToVerify = [
    {
        contract: 'savingsAccount',
        proxy: contractAddresses.savingsAccount,
    },
    {
        contract: 'strategyRegistry',
        proxy: contractAddresses.strategyRegistry,
    },
    {
        contract: 'creditLines',
        proxy: contractAddresses.creditLines,
    },
    {
        contract: 'noYield',
        proxy: contractAddresses.noYield,
    },
    {
        contract: 'aaveYield',
        proxy: contractAddresses.aaveYield,
    },
    {
        contract: 'compoundYield',
        proxy: contractAddresses.compoundYield,
    },
    {
        contract: 'verification',
        proxy: contractAddresses.verification,
    },
    {
        contract: 'adminVerifier',
        proxy: contractAddresses.adminVerifier,
    },
    {
        contract: 'priceOracle',
        proxy: contractAddresses.priceOracle,
    },
    {
        contract: 'extension',
        proxy: contractAddresses.extension,
    },
    {
        contract: 'pool',
        proxy: contractAddresses.poolLogic,
    },
    {
        contract: 'repayments',
        proxy: contractAddresses.repaymentLogic,
    },
    {
        contract: 'poolFactory',
        proxy: contractAddresses.poolFactory,
    },
];

const supportingContracts = {
    weth: contractAddresses.weth,
    savingsAccount: contractsToVerify.filter((a) => a.contract === 'savingsAccount')[0].proxy,
    creditLines: contractsToVerify.filter((a) => a.contract === 'creditLines')[0].proxy,
    bin: contractAddresses.admin, // admin,
    owner: contractAddresses.admin, //admin,
    poolLogic: contractsToVerify.filter((a) => a.contract === 'pool')[0].proxy,
};

const helperContractsToVerify = {
    CreditLineUtils: contractAddresses.creditLineUtils,
    PoolUtils: contractAddresses.poolUtils,
    SavingsAccountEthUtils: contractAddresses.savingsAccountEthUtils,
    beacon: contractAddresses.beacon,
};

export { contractsToVerify, helperContractsToVerify, supportingContracts, contractAddresses };
