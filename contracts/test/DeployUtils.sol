// SPDX-License-Identifier: MIT
pragma solidity 0.7.0;

import "ds-test/test.sol";

import "./roles/User.sol";

import '../interfaces/IPriceOracle.sol';
import '../interfaces/IYield.sol';
import '../interfaces/ISavingsAccount.sol';
import '../interfaces/IStrategyRegistry.sol';
import '../interfaces/IPool.sol';
import '../interfaces/IPoolFactory.sol';
import '../interfaces/IRepayment.sol';

import "../Pool/Extension.sol";
import "../Pool/Repayments.sol";
import "../Pool/PoolFactory.sol";
import "../Pool/Pool.sol";

import "../SavingsAccount/SavingsAccount.sol";
import "../SavingsAccount/SavingsAccountUtil.sol";

import "../CreditLine/CreditLine.sol";

import "../yield/AaveYield.sol";
import "../yield/CompoundYield.sol";
import "../yield/NoYield.sol";
import "../yield/YearnYield.sol";
import "../yield/StrategyRegistry";

import "../PriceOracle.sol";

interface Hevm {
    function warp(uint256) external;
    function store(address,bytes32,bytes32) external;
}

contract DeployUtils is DSTest, Constants {
    using SafeERC20 for IERC20;
    using SafeMath for uint256;

    Hevm hevm;

    PriceOracle priceOracleObj;
    StrategyRegistry strategyRegistryObj;
    CreditLine creditLineObj;
    SavingsAccount savingsAccountObj;
    NoYield noYieldObj;

    

    constructor() public { hevm = Hevm(address(bytes20(uint160(uint256(keccak256("hevm cheat code")))))); }

    function mint(bytes32 symbol, address account, uint256 amt) public {
        address addr = tokens[symbol].addr;
        uint256 slot  = tokens[symbol].slot;
        uint256 bal = IERC20(addr).balanceOf(account);

        hevm.store(
            addr,
            keccak256(abi.encode(account, slot)), // Mint tokens
            bytes32(bal + amt)
        );

        assertEq(IERC20(addr).balanceOf(account), bal + amt); // Assert new balance
    }

    function deployPriceOracle() public {
        priceOracleObj = new PriceOracle();
        priceOracleObj.initialize(address(admin));
    }

    function deployStrategyRegistry() public {
        strategyRegistryObj = new StrategyRegistry();
        strategyRegistryObj.initialize(address(admin), 5); //initializing with 5 max. strategies
    }

    function deployCreditLines() public {
        creditLineObj = new CreditLine();
        creditLineObj.initialize(
            
        )
    }

    function deploySavingsAccount() public {
        savingsAccountObj = new SavingsAccount();
        savingsAccountObj.initialize(address(admin), address(strategyRegistryObj), address(creditLineObj));
    }

    function deployNoYield() public {
        noYieldObj = new NoYield();
        noYieldObj.initialize(address(admin), address(savingsAccountObj));
    }

    function deployCompoundYield() public {
        compoundYieldObj = new CompoundYield();
        compoundYieldObj.initialize(address(admin), address(savingsAccountObj));
    }

    function deployAaveYield() public {
        aaveYieldObj = new AaveYield();
        aaveYieldObj.initialize(address(admin), address(savingsAccountObj), wethGateway, 
                                aaveProtocolDataProvider, aaveLendingPoolAddressesProvider);
    }

    function deployYearnYield() public {
        yearnYieldObj = new YearnYield();
        yearnYieldObj.initialize(address(admin), address(savingsAccountObj));
    }

    // need to convert this to Solc 
    //export function getPoolInitSigHash(): BytesLike {
    //const _interface = new ethers.utils.Interface(poolContractMeta.abi);
    //const poolInitializeSigHash = _interface.getSighash('initialize');
    //return poolInitializeSigHash;
    //}

    function deployProtocolFeeCollector() public {
        protocolFeeCollectorObj = new ProtocolFeeCollector(admin);
        protocolFeeCollectorObj.initialize(admin);
    }

    function deployPoolFactory(uint256 collectionPeriod, uint256 loanWithdrawalDuration,
                                uint256 marginCallDuration, ) public {
        poolFactoryObj = new PoolFactory();
        poolFactoryObj.initialize(
            address(admin),
            5_000_000, //collectionPeriod,
            15_000_000, //loanWithdrawalDuration,
            300, //marginCallDuration,
            //poolInitFuncSelector,
            15 * 1e28, //_liquidatorRewardFraction, 0.15
            10 * 1e28, //_poolCancelPenaltyMultiple, 0.1
            10 * 1e28, //_minBorrowFraction 0.1
            1e26, //_protocolFeeFraction
            address(protocolFeeCollectorObj), //_protocolFeeCollector
            address(noYieldObj) //_noStrategy
        )
    }

    function deployRepayments() public {
        repaymentsObj = new Repayments();
        repaymentsObj.initialize(poolFactoryObj, //_poolFactory
                                1e29, // _gracePenaltyRate
                                1e29) // _gracePeriodFraction
    }

    function deployExtensions() public {
        extensionsObj = new Extension();
        extensionsObj.initialize(poolFactoryObj,
                                50 * 1e28) // voting pass ratio
    }

    function deployVerification() public {
        verificationObj = new Verification();
        verificationObj.initialize(address(admin));
    }

    function deployAdminVerifier() public {
        adminVerifierObj = new adminVerifier();
        adminVerifierObj.initialize(address(admin), address(verificationObj));
    }

    function setUpCreditLines() public {
        deployPriceOracle(admin);
        deployStrategyRegistry(admin);
        deployCreditLines(admin);
        deploySavingsAccount(admin);
        deployNoYield(admin);
        deployCompoundYield(admin);
        deployProtocolFeeCollector(admin);
        deployVerification(admin);
        deployAdminVerifier(admin);
    }

    function setUpAllContracts() public {
        deployPriceOracle(admin);
        deployStrategyRegistry(admin);
        deployCreditLines(admin);
        deploySavingsAccount(admin);
        deployNoYield(admin);
        deployCompoundYield(admin);
        deployProtocolFeeCollector(admin);
        deployVerification(admin);
        deployAdminVerifier(admin);
        deployPoolFactory(admin);
        deployRepayments(admin);
        deployExtensions(admin);
    }

}