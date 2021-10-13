// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.7.0;

interface IPriceOracle {
    event ChainlinkFeedUpdated(address indexed token, address indexed priceOracle);
    event UniswapFeedUpdated(address indexed token1, address indexed token2, bytes32 feedId, address indexed pool);
    event UniswapPriceAveragingPeriodUpdated(uint32 uniswapPriceAveragingPeriod);
    
    function getLatestPrice(address num, address den) external view returns (uint256, uint256);

    function doesFeedExist(address token1, address token2) external view returns (bool);
}
