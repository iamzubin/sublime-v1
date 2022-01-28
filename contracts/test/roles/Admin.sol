pragma solidity 0.7.0;

import "../../CreditLine/CreditLine.sol";
import "../../PriceOracle.sol";
import "../../SavingsAccount/SavingsAccount.sol";
import "../../yield/StrategyRegistry.sol";
import "../../yield/NoYield.sol";

import "../DeployUtils.sol";


contract User is DeployUtils {
    function updateSavingsAccount(address _address, CreditLine creditLineContract) public {
        creditLineContract.updateSavingsAccount(_address);
    }

    function setPriceFeeds(PriceOracle priceOracleObj, address assetAddress, address oracleAddress) public {
        priceOracleObj.setChainlinkFeedAddress(assetAddress, oracleAddress);
    }
}