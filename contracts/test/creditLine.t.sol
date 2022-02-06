pragma solidity 0.7.6;

import "ds-test/test.sol";
import "lib/openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";

import "../CreditLine/CreditLine.sol";
import "../PriceOracle.sol";
import "../SavingsAccount/SavingsAccount.sol";
import "./roles/Admin.sol";
import "../yield/StrategyRegistry.sol";
import "../yield/NoYield.sol";

import "./DeployUtils.sol";
import "./ActorsUtils.sol";
import "./Constants.sol";

import '@openzeppelin/contracts/token/ERC20/SafeERC20.sol';
import '@openzeppelin/contracts/math/SafeMath.sol';
import '@openzeppelin/contracts/utils/ReentrancyGuard.sol';
import '@openzeppelin/contracts-upgradeable/proxy/Initializable.sol';
import '@openzeppelin/contracts-upgradeable/token/ERC20/ERC20PausableUpgradeable.sol';

import "./TestUtils.sol";
import "./Scenarios.sol";


contract CreditLineTest is TestUtils, Scenarios {

    function setUp() public {
        SetUpGlobalActors();
        SetUpCreditLineActors();
        SetUpCreditLines();
    }

    function create_creditLineReqeuest() public {
        creditLineBorrower.createRequest(address(creditLine), address(creditLineLender),
                                    1e31,
                                    1e29,
                                    false,
                                    1e30,
                                    DAI,
                                    WETH,
                                    false);
    }

    function testFail_invalidLender_1() public {
        //CreditLineRequestVars memory obj = CreditLineRequestVars(, , , , , , );

        try creditLineBorrower.createRequest(address(creditLine), address(creditLineBorrower),
                                    1e31,
                                    1e29,
                                    false,
                                    1e30,
                                    DAI,
                                    WETH,
                                    false) {
                                        assertTrue(true);
                                    }
        catch Error(string memory reason) {
            assertEq(reason, "CL14");
        }
    }

    function testFail_invalidLender_2() public {
        //CreditLineRequestVars memory obj = CreditLineRequestVars(, , , , , , );

        try creditLineBorrower.createRequest(address(creditLine), address(creditLineBorrower),
                                    1e31,
                                    1e29,
                                    false,
                                    1e30,
                                    DAI,
                                    WETH,
                                    true) {
                                        assertTrue(true);
                                    }
        catch Error(string memory reason) {
            assertEq(reason, "CL14");
        }
    }

    function testFail_invalidBorrower_1() public {
        //CreditLineRequestVars memory obj = CreditLineRequestVars(, , , , , , );

        try creditLineLender.createRequest(address(creditLine), address(creditLineLender),
                                    1e31,
                                    1e29,
                                    false,
                                    1e30,
                                    DAI,
                                    WETH,
                                    false) {
                                        assertTrue(true);
                                    }
        catch Error(string memory reason) {
            assertEq(reason, "CL14");
        }
    }

    function testFail_invalidBorrower_2() public {
        //CreditLineRequestVars memory obj = CreditLineRequestVars(, , , , , , );

        try creditLineLender.createRequest(address(creditLine), address(creditLineLender),
                                    1e31,
                                    1e29,
                                    false,
                                    1e30,
                                    DAI,
                                    WETH,
                                    true) {
                                        assertTrue(true);
                                    }
        catch Error(string memory reason) {
            assertEq(reason, "CL14");
        }
    }

    function testFail_invalidCollateralRatio() public {
        try creditLineBorrower.createRequest(address(creditLine), address(creditLineLender),
                                    1e31,
                                    1e29,
                                    false,
                                    5*1e30 + 1,
                                    DAI,
                                    WETH,
                                    false) {
                                        assertTrue(true);
                                    }
        catch Error(string memory reason) {
            assertEq(reason, 'CL13');
        }
    }

    function test_validRequest_asBorrower() public {
        try creditLineBorrower.createRequest(address(creditLine), address(creditLineLender),
                                    1e31,
                                    1e29,
                                    false,
                                    5*1e30 + 1,
                                    DAI,
                                    WETH,
                                    false) {
                                        assertTrue(true);
                                    }
        catch Error(string memory reason) {
            assertEq(reason, 'CL13');
        }
    }

    function test_validRequest_asLender() public {
        try creditLineLender.createRequest(address(creditLine), address(creditLineBorrower),
                                    1e31,
                                    1e29,
                                    false,
                                    5*1e30 + 1,
                                    DAI,
                                    WETH,
                                    true) {
                                        assertTrue(true);
                                    }
        catch Error(string memory reason) {
            assertEq(reason, 'CL13');
        }
    }

    function test_mint() public {
        mint(USDC, address(creditLineBorrower), 1_550_000 * USD_decimals);

        uint256 balance = IERC20(USDC).balanceOf(address(creditLineBorrower));

        assertEq(1_550_000 * USD_decimals, balance);
    }

    //function test_prices() public {
    //    (uint256 price1, ) = priceOracle.getChainlinkLatestPrice(USDC, WETH);
    //    (uint256 price2, ) = priceOracle.getUniswapLatestPrice(USDC, WETH); 
    //    assertEq(price1, price2);
    //}

}