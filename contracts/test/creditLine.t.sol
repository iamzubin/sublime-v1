pragma solidity 0.7.0;

import "ds-test/test.sol";
import "lib/openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";

import "../CreditLine/CreditLine.sol";
import "../PriceOracle.sol";
import "../SavingsAccount/SavingsAccount.sol";
import "./roles/Admin.sol";
import "../yield/StrategyRegistry.sol";
import "../yield/NoYield.sol";


contract TestCreditLine is DSTest, CreditLine {

    address constant DAI   = 0x6B175474E89094C44Da98b954EedeAC495271d0F;
    address constant USDC  = 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48;
    address constant WETH  = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;

    IERC20 constant dai  = IERC20(DAI);
    IERC20 constant usdc = IERC20(USDC);
    IERC20 constant weth = IERC20(WETH);

    uint256 constant USD = 10 ** 6;  // USDC precision decimals
    uint256 constant BTC = 10 ** 8;  // WBTC precision decimals
    uint256 constant WAD = 10 ** 18;
    uint256 constant RAY = 10 ** 27;

    mapping(address => address) oracleAddress;

    Governor governor;
    PriceOracle priceOracleObj;
    StrategyRegistry strategyRegistryObj;
    CreditLine creditLineObj;
    SavingsAccount savingsAccountObj;
    NoYield noYieldObj;


    function setUp() public {
        governor = new Governor();

        priceOracleObj = new PriceOracle();
        priceOracleObj.initialize(address(governor));


        strategyRegistryObj = new StrategyRegistry();
        strategyRegistryObj.initialize(address(governor), 5);

        creditLineObj = new CreditLine();
        creditLineObj.initialize(address(noYieldObj), 
                                address(priceOracleObj),
                                address(0),
                                address(strategyRegistryObj),
                                address(governor),
                                0,
                                address(this),
                                0);


        savingsAccountObj = new SavingsAccount();
        savingsAccountObj.initialize(address(governor), address(strategyRegistryObj), address(creditLineObj));

        noYieldObj = new NoYield();
        noYieldObj.initialize(address(governor), address(savingsAccountObj));

        governor.updateSavingsAccount(address(savingsAccountObj), creditLineObj);

        oracleAddress[DAI] = 0xAed0c38402a5d19df6E4c03F4E2DceD6e29c1ee9;
        oracleAddress[WETH] = 0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419;
        oracleAddress[USDC] = 0x8fFfFfd4AfB6115b954Bd326cbe7B4BA576818f6;

        governor.setPriceFeeds(priceOracleObj, DAI, oracleAddress[DAI]);
        governor.setPriceFeeds(priceOracleObj, WETH, oracleAddress[WETH]);
        governor.setPriceFeeds(priceOracleObj, USDC, oracleAddress[USDC]);
    }

    function test_creditLineRequest() public {

        try creditLineObj.request(address(this), 10, 10, false,
                            10, 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48,
                            0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2, false) {
                                assertTrue(true);
                            }
        catch Error(string memory reason) {
            assertEq(reason, "Lender and Borrower cannot be same addresses");
        }
    }

    function testFail_creditLineRequest() public {

        creditLineObj.request(address(this), 10, 10, false,
                                10, 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48,
                                0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2, false);
                                
    }

}