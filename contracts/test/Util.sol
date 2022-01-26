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

contract Util is DSTest {
    using SafeERC20 for IERC20;
    using SafeMath for uint256;

    Hevm hevm;

    User admin;
    User fakeAdmin;

    User verifier;
    User fakeVerifier;

    User bob;

    User poolBorrower;
    User poolLender_1;
    User poolLender_2;
    User poolLender_3;
    User poolLiquidator;

    User creditLineBorrower;
    User creditLineLender;
    User creditLineLiquidator;

    // Price feed addresses
    // We'll be creating price feeds for:-
    // 1. WETH / USDC
    // 2. WBTC / WETH
    // 3. WBTC / DAI

    address constant DAI   = 0x6B175474E89094C44Da98b954EedeAC495271d0F;
    address constant USDC  = 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48;
    address constant WETH  = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;
    address constant WBTC  = 0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599;

    IERC20 constant dai  = IERC20(DAI);
    IERC20 constant usdc = IERC20(USDC);
    IERC20 constant weth = IERC20(WETH);
    IERC20 constant wbtc = IERC20(WBTC);

    uint256 constant USD_decimals = 10 ** 6;  // USDC precision decimals
    uint256 constant BTC_decimals = 10 ** 8;  // WBTC precision decimals
    
    uint256 constant WAD = 10 ** 18;
    uint256 constant RAY = 10 ** 27;

    constructor() public { hevm = Hevm(address(bytes20(uint160(uint256(keccak256("hevm cheat code")))))); }

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

    function createDaiChainlinkOracle() public {

    }

    function createWethChainlinkOracle() public {

    }



    function deployGlobalContracts() public {

    }

    function setUpGlobalContracts() public {

    }

    function setUpPriceFeeds() public {

    }

}