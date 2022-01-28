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
        poolBorrower = new PoolBorrower();
    }
    
    function createPoolLenders() public {
        poolLender_1 = new PoolLender();
        poolLender_2 = new PoolLender();
        poolLender_3 = new PoolLender();
    }

    function createPoolLiquidator() public {
        poolLiquidator = new PoolLiquidator();
    }

    function createCreditLineBorrower() public {
        creditLineBorrower = new CreditLineBorrower();
    }

    function createCreditLineLender() public {
        creditLineLender = new CreditLineLender();
    }

    function createCreditLineLiquidator() public {
        creditLineLiquidator = new CreditLineLiquidator();
    }

    function createAdmin() public {
        admin = new Admin();
    }

    function createFakeAdmin() public {
        fakeAdmin = new Admin();
    }

    function createVerifier() public {
        verifier = new Verifier();
    }

    function createFakeVerifier() public {
        fakeVerifier = new Verifier();
    }

    function createBob() public {
        bob = new SavingsAccountUser();
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
