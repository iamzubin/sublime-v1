pragma solidity 0.7.0;

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

    function test_creditLineRequest() public {
        //CreditLineRequestVars memory obj = CreditLineRequestVars(, , , , , , );

        try creditLineBorrower.createRequest(address(creditLine), address(creditLineLender),
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
            assertEq(reason, "Lender and Borrower cannot be same address");
        }
    }

    function test_1creditLineRequest() public {
        try creditLineBorrower.createRequest(address(creditLine), address(creditLineBorrower),
                                            CreditLine_1.borrowLimit,
                                            CreditLine_1.borrowRate,
                                            CreditLine_1.autoLiquidation,
                                            CreditLine_1.collateralRatio,
                                            CreditLine_1.borrowAsset,
                                            CreditLine_1.collateralAsset,
                                            CreditLine_1.requestAsLender) {
                                                assertTrue(true);
                                            }
        catch Error(string memory reason) {
            assertEq(reason, "Lender and Borrower cannot be same address");
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