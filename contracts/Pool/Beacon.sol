// SPDX-License-Identifier: MIT
pragma solidity 0.7.6;
import '@openzeppelin/contracts/proxy/IBeacon.sol';
import '@openzeppelin/contracts/access/Ownable.sol';

contract Beacon is IBeacon, Ownable {
    address public impl;

    constructor(address _owner, address _impl) {
        impl = _impl;
        transferOwnership(_owner);
    }

    function implementation() external view override returns (address) {
        return impl;
    }

    function changeImpl(address _newImpl) external onlyOwner {
        impl = _newImpl;
    }
}
