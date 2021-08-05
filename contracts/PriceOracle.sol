// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.7.0;

import '@chainlink/contracts/src/v0.7/interfaces/AggregatorV3Interface.sol';
import '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';
import '@openzeppelin/contracts/math/SafeMath.sol';
import '@openzeppelin/contracts/token/ERC20/ERC20.sol';

import './interfaces/IPriceOracle.sol';

contract PriceOracle is Initializable, OwnableUpgradeable, IPriceOracle {
    using SafeMath for uint256;

    AggregatorV3Interface internal priceFeed;
    struct PriceData {
        address oracle;
        uint256 decimals;
    }
    mapping(address => PriceData) feedAddresses;

    function initialize(address _admin) public initializer {
        OwnableUpgradeable.__Ownable_init();
        OwnableUpgradeable.transferOwnership(_admin);
    }

    function getLatestPrice(address num, address den) public view override returns (uint256, uint256) {
        PriceData memory _feedData1 = feedAddresses[num];
        PriceData memory _feedData2 = feedAddresses[den];
        require(
            _feedData1.oracle != address(0) && _feedData2.oracle != address(0),
            "PriceOracle::getLatestPrice - Price Feed doesn't exist"
        );
        int256 price1;
        int256 price2;
        (, price1, , , ) = AggregatorV3Interface(_feedData1.oracle).latestRoundData();
        (, price2, , , ) = AggregatorV3Interface(_feedData2.oracle).latestRoundData();
        // TODO: Store token decimals when adding and don't query for every price get
        uint256 price =
            uint256(price1)
                .mul(10**_feedData2.decimals)
                .mul(10**30)
                .div(uint256(price2))
                .div(10**_feedData1.decimals)
                .mul(10**getDecimals(den))
                .div(10**getDecimals(num));
        return (price, 30);
    }

    function getDecimals(address _token) view internal returns (uint8) {
        try ERC20(_token).decimals() returns (uint8 v) {
            return v;
        } catch Error(string memory) {
            return 0;
        } catch (bytes memory) {
            return 0;
        }
    }

    function doesFeedExist(address[] calldata tokens) external view override returns (bool) {
        for (uint256 i = 0; i < tokens.length; i++) {
            if (feedAddresses[tokens[i]].oracle == address(0)) {
                return false;
            }
        }
        return true;
    }

    function setfeedAddress(address token, address priceOracle) external onlyOwner {
        uint256 priceOracleDecimals = AggregatorV3Interface(priceOracle).decimals();
        feedAddresses[token] = PriceData(priceOracle, priceOracleDecimals);
    }
}
