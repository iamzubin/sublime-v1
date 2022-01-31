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


contract CreditLineTest is TestUtils {

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

}