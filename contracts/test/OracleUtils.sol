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

contract OracleUtils is DSTest, Constants {
    using SafeERC20 for IERC20;
    using SafeMath for uint256;

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
