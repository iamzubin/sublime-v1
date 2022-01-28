// SPDX-License-Identifier: MIT
pragma solidity 0.7.0;

import "ds-test/test.sol";

import "./roles/Admin.sol";
import "./roles/PoolBorrower.sol";
import "./roles/PoolLender.sol";
import "./roles/PoolLiquidator.sol";
import "./roles/CreditLineBorrower.sol";
import "./roles/CreditLineLender.sol";
import "./roles/CreditLineLiquidator.sol";
import "./roles/SavingsAccountUser.sol";
import "./roles/Verifier.sol";

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

    Admin admin;
    Admin fakeAdmin;

    Verifier verifier;
    Verifier fakeVerifier;

    SavingsAccountUser bob;

    PoolBorrower poolBorrower;
    PoolLender poolLender_1;
    PoolLender poolLender_2;
    PoolLender poolLender_3;
    PoolLiquidator poolLiquidator;

    CreditLineBorrower creditLineBorrower;
    CreditLineLender creditLineLender;
    CreditLineLiquidator creditLineLiquidator;

    function createPoolBorrower() public {
        poolBorrower = new User();
    }
    
    function createPoolLenders() public {
        poolLender_1 = new User();
        poolLender_2 = new User();
        poolLender_3 = new User();
    }

    function createPoolLiquidator() public {
        poolLiquidator = new User();
    }

    function createCreditLineBorrower() public {
        creditLineBorrower = new User();
    }

    function createCreditLineLender() public {
        creditLineLender = new User();
    }

    function createCreditLineLiquidator() public {
        creditLineLiquidator = new User();
    }

    function createAdmin() public {
        admin = new User();
    }

    function createFakeAdmin() public {
        fakeAdmin = new User();
    }

    function createVerifier() public {
        verifier = new User();
    }

    function createFakeVerifier() public {
        fakeVerifier = new User();
    }

    function createBob() public {
        bob = new User();
    }

    function setUpPoolActors() public {
        createPoolBorrower();
        createPoolLenders();
        createPoolLiquidator();
    }

    function setUpCreditLineActors() public {
        createCreditLineBorrower();
        createCreditLineLender();
        createCreditLineLiquidator();
    }

    function setUpGlobalActors() public {
        createAdmin();
        createFakeAdmin();

        createVerifier();
        createFakeVerifier();

        createBob();
    }

}
