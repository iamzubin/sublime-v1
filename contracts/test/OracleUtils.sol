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

contract OracleUtils is DSTest {
    using SafeERC20 for IERC20;
    using SafeMath for uint256;

    // Price feed addresses
    // We'll be creating price feeds for:-
    // 1. WETH / USDC
    // 2. WBTC / WETH
    // 3. WBTC / DAI
    address constant DAI   = 0x6B175474E89094C44Da98b954EedeAC495271d0F;
    address constant USDC  = 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48;
    address constant WETH  = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;
    address constant WBTC  = 0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599;

    // Chainlink base feeds against USD
    address constant ETH_priceFeedChainlink = 0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419;
    address constant WBTC_priceFeedChainlink = 0xF4030086522a5bEEa4988F8cA5B36dbC97BeE88c;
    address constant DAI_priceFeedChainlink = 0xAed0c38402a5d19df6E4c03F4E2DceD6e29c1ee9;
    address constant USDC_priceFeedChainlink = 0x8fFfFfd4AfB6115b954Bd326cbe7B4BA576818f6;

    address constant USDC_ETH_priceFeedUniswap = 0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8;
    address constant WBTC_WETH_priceFeedUniswap = 0xCBCdF9626bC03E24f779434178A73a0B4bad62eD;
    address constant WBTC_DAI_priceFeedUniswap = 0x391E8501b626C623d39474AfcA6f9e46c2686649; //has low liquidity

    IERC20 constant dai  = IERC20(DAI);
    IERC20 constant usdc = IERC20(USDC);
    IERC20 constant weth = IERC20(WETH);
    IERC20 constant wbtc = IERC20(WBTC);

    uint256 constant USD_decimals = 10 ** 6;  // USDC precision decimals
    uint256 constant BTC_decimals = 10 ** 8;  // WBTC precision decimals

    uint256 constant WAD = 10 ** 18;
    uint256 constant RAY = 10 ** 27;

    function create_WETH_chainlinkOracle(User admin) public {
        admin.setChainlinkFeedAddress(WETH, ETH_priceFeedChainlink);
    }

    function create_DAI_chainlinkOracle(User admin) public {
        admin.setChainlinkFeedAddress(DAI, DAI_priceFeedChainlink);
    }

    function create_USDC_chainlinkOracle(User admin) public {
        admin.setChainlinkFeedAddress(USDC, USDC_priceFeedChainlink);
    }

    function create_WBTC_chainlinkOracle(User admin) public {
        admin.setChainlinkFeedAddress(WBTC, WBTC_priceFeedChainlink);
    }

    function create_USDC_ETH_uniswapOracle(User admin) public {
        admin.setUniswapFeedAddress(USDC, WETH, USDC_ETH_priceFeedUniswap);
    }

    function create_WBTC_WETH_uniswapOracle(User admin) public {
        admin.setUniswapFeedAddress(WBTC, WETH, WBTC_WETH_priceFeedUniswap);
    }

    function create_WBTC_DAI_uniswapOracle(User admin) public {
        admin.setUniswapFeedAddress(WBTC, DAI, WBTC_DAI_priceFeedUniswap);
    }

    function setUpAllOracles(User admin) public {
        create_WETH_chainlinkOracle(admin);
        create_DAI_chainlinkOracle(admin);
        create_USDC_chainlinkOracle(admin);
        create_WBTC_chainlinkOracle(admin);

        create_USDC_ETH_uniswapOracle(admin);
        create_WBTC_WETH_uniswapOracle(admin);
        create_WBTC_DAI_uniswapOracle(admin);
    }

    function setUpChainlinkOracles(User admin) public {
        create_WETH_chainlinkOracle(admin);
        create_DAI_chainlinkOracle(admin);
        create_USDC_chainlinkOracle(admin);
        create_WBTC_chainlinkOracle(admin);
    }

    function setUpUniswapOracles(User admin) public {
        create_USDC_ETH_uniswapOracle(admin);
        create_WBTC_WETH_uniswapOracle(admin);
        create_WBTC_DAI_uniswapOracle(admin);
    }

    function setUp_USDC_ETH_oracles(User admin) public {
        create_USDC_chainlinkOracle(admin);
        create_WETH_chainlinkOracle(admin);

        create_USDC_ETH_uniswapOracle(admin);
    }

}
