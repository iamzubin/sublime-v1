pragma solidity 0.7.6;

import '@openzeppelin/contracts/token/ERC20/SafeERC20.sol';
import '@openzeppelin/contracts/math/SafeMath.sol';
import '@openzeppelin/contracts/utils/ReentrancyGuard.sol';
import '@openzeppelin/contracts-upgradeable/proxy/Initializable.sol';
import '@openzeppelin/contracts-upgradeable/token/ERC20/ERC20PausableUpgradeable.sol';

import "../DeployUtils.sol";
import "../Constants.sol";
import "../ProtocolFeeCollector.sol";

import "../../PriceOracle.sol";

import "../../interfaces/ICreditLine.sol";
import "../../interfaces/IPriceOracle.sol";

contract Admin is Constants {
    using SafeERC20 for IERC20;
    using SafeMath for uint256;

    function updateBorrowLimitLimits(address creditLine, uint256 min, uint256 max) public {
        ICreditLine(creditLine).updateBorrowLimitLimits(min, max);
    }

    function updateIdealCollateralRatioLimits(address creditLine, uint256 min, uint256 max) public {
        ICreditLine(creditLine).updateIdealCollateralRatioLimits(min, max);
    }

    function updateBorrowRateLimits(address creditLine, uint256 min, uint256 max) public {
        ICreditLine(creditLine).updateBorrowRateLimits(min, max);
    }

    function updateSavingsAccount(address creditLine, address savingsAccount) public {
        ICreditLine(creditLine).updateSavingsAccount(savingsAccount);
    }

    function updateDefaultStrategy(address creditLine, address noYield) public {
        ICreditLine(creditLine).updateDefaultStrategy(noYield);
    }

    function setChainlinkPriceFeed(address priceOracle, address asset, address oracle) public {
        IPriceOracle(priceOracle).setChainlinkFeedAddress(asset, oracle);
    }

    function setUpAllOracles(address priceOracleAddress) public {
        IPriceOracle priceOracle = IPriceOracle(priceOracleAddress);

        priceOracle.setChainlinkFeedAddress(WETH, ETH_priceFeedChainlink);
        priceOracle.setChainlinkFeedAddress(DAI, DAI_priceFeedChainlink);
        priceOracle.setChainlinkFeedAddress(USDC, USDC_priceFeedChainlink);
        priceOracle.setChainlinkFeedAddress(WBTC, WBTC_priceFeedChainlink);

        priceOracle.setUniswapFeedAddress(USDC, WETH, USDC_ETH_priceFeedUniswap);
        priceOracle.setUniswapFeedAddress(WBTC, WETH, WBTC_WETH_priceFeedUniswap);
        priceOracle.setUniswapFeedAddress(WBTC, DAI, WBTC_DAI_priceFeedUniswap);

        priceOracle.setUniswapPriceAveragingPeriod(10);
    }

    function setUpChainlinkOracles(address priceOracleAddress) public {
        IPriceOracle priceOracle = IPriceOracle(priceOracleAddress);

        priceOracle.setChainlinkFeedAddress(WETH, ETH_priceFeedChainlink);
        priceOracle.setChainlinkFeedAddress(DAI, DAI_priceFeedChainlink);
        priceOracle.setChainlinkFeedAddress(USDC, USDC_priceFeedChainlink);
        priceOracle.setChainlinkFeedAddress(WBTC, WBTC_priceFeedChainlink);
    }

    function setUpUniswapOracles(address priceOracleAddress) public {
        IPriceOracle priceOracle = IPriceOracle(priceOracleAddress);

        priceOracle.setUniswapFeedAddress(USDC, WETH, USDC_ETH_priceFeedUniswap);
        priceOracle.setUniswapFeedAddress(WBTC, WETH, WBTC_WETH_priceFeedUniswap);
        priceOracle.setUniswapFeedAddress(WBTC, DAI, WBTC_DAI_priceFeedUniswap);
    }

    function setUp_USDC_ETH_oracles(address priceOracleAddress) public {
        IPriceOracle priceOracle = IPriceOracle(priceOracleAddress);

        priceOracle.setChainlinkFeedAddress(USDC, USDC_priceFeedChainlink);
        priceOracle.setChainlinkFeedAddress(WETH, ETH_priceFeedChainlink);

        priceOracle.setUniswapFeedAddress(USDC, WETH, USDC_ETH_priceFeedUniswap);
    }

}