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

interface Hevm {
    function warp(uint256) external;
    function store(address,bytes32,bytes32) external;
}

contract DeployUtils is DSTest {
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

    function deployPriceOracle(User admin) public {
        priceOracleObj = new PriceOracle();
        priceOracleObj.initialize(address(admin));
    }

    function deployStrategyRegistry(User admin) public {
        strategyRegistryObj = new StrategyRegistry();
        strategyRegistryObj.initialize(address(admin), 5); //initializing with 5 max. strategies
    }

    function deployCreditLines(User admin) public {
        creditLineObj = new CreditLine();
        creditLineObj.initialize(
            
        )
    }

    function deploySavingsAccount(User admin) public {
        savingsAccountObj = new SavingsAccount();
        savingsAccountObj.initialize(address(admin), address(strategyRegistryObj), address(creditLineObj));
    }

    function deployNoYield(User admin) public {
        noYieldObj = new NoYield();
        noYieldObj.initialize(address(admin), address(savingsAccountObj));
    }

    function deployGlobalContracts() public {

    }

    function setUpGlobalContracts() public {

    }

}