// SPDX-License-Identifier: MIT
pragma solidity 0.7.0;

import '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';

contract ProtocolFeeCollector is ReentrancyGuard, OwnableUpgradeable  {
    
    function initialize(address _owner) external initializer {
        OwnableUpgradeable.__Ownable_init();
        OwnableUpgradeable.transferOwnership(_owner);
    } 

}