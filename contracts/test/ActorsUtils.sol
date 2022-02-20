// SPDX-License-Identifier: MIT
pragma solidity 0.7.6;

import "ds-test/test.sol";

import "./roles/Admin.sol";
import "./roles/PoolActor.sol";
import "./roles/CreditLineActor.sol";
import "./roles/SavingsAccountUser.sol";
import "./roles/Verifier.sol";
import "./roles/TwitterWorker.sol";

import '../interfaces/IPriceOracle.sol';
import '../interfaces/IYield.sol';
import '../interfaces/ISavingsAccount.sol';
import '../interfaces/IStrategyRegistry.sol';
import '../interfaces/IPool.sol';
import '../interfaces/IPoolFactory.sol';
import '../interfaces/IRepayment.sol';


import './interface/IHevm.sol';

contract ActorsUtils {
    using SafeERC20 for IERC20;
    using SafeMath for uint256;

    Admin admin;
    Admin fakeAdmin;

    Verifier verifier;
    Verifier fakeVerifier;

    SavingsAccountUser bob;

    PoolActor poolBorrower;
    PoolActor poolLender_1;
    PoolActor poolLender_2;
    PoolActor poolLender_3;
    PoolActor poolLiquidator;

    CreditLineActor creditLineBorrower;
    CreditLineActor creditLineLender;
    CreditLineActor creditLineLiquidator;

    TwitterWorker twitterWorker;

    Hevm twitterSigner_1;
    Hevm twitterSigner_2;

    function createPoolBorrower() public {
        poolBorrower = new PoolActor();
    }
    
    function createPoolLenders() public {
        poolLender_1 = new PoolActor();
        poolLender_2 = new PoolActor();
        poolLender_3 = new PoolActor();
    }

    function createPoolLiquidator() public {
        poolLiquidator = new PoolActor();
    }

    function createCreditLineBorrower() public {
        creditLineBorrower = new CreditLineActor();
    }

    function createCreditLineLender() public {
        creditLineLender = new CreditLineActor();
    }

    function createCreditLineLiquidator() public {
        creditLineLiquidator = new CreditLineActor();
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

    function createTwitterWorker() public {
        twitterWorker = new TwitterWorker();
    }

    function createBob() public {
        bob = new SavingsAccountUser();
    }

    function SetUpPoolActors() public {
        createPoolBorrower();
        createPoolLenders();
        createPoolLiquidator();
    }

    function SetUpCreditLineActors() public {
        createCreditLineBorrower();
        createCreditLineLender();
        createCreditLineLiquidator();
    }

    function SetUpGlobalActors() public {
        createAdmin();
        createFakeAdmin();

        createVerifier();
        createFakeVerifier();

        createBob();
    }
    function SetUpTwitterVerifierActors() public {
        createTwitterWorker();
    }

}
