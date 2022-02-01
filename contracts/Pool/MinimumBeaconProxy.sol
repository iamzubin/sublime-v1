// SPDX-License-Identifier: MIT
pragma solidity 0.7.6;

import '@openzeppelin/contracts/proxy/IBeacon.sol';

contract MinimumBeaconProxy {
    bytes32 private constant _BEACON_SLOT = 0xa3f0ad74e5423aebfd80d3ef4346578335a9a72aeaee59ff6cb3582b35133d50;

    constructor(address beacon) {
        assembly {
            sstore(_BEACON_SLOT, beacon)
        }
    }

    function _implementation() internal view virtual returns (address) {
        address beacon;
        assembly {
            beacon := sload(_BEACON_SLOT)
        }
        return IBeacon(beacon).implementation();
    }

    fallback() external {
        address impl = _implementation();
        assembly {
            calldatacopy(0, 0, calldatasize())
            let result := delegatecall(gas(), impl, 0, calldatasize(), 0, 0)

            returndatacopy(0, 0, returndatasize())

            switch result
            case 0 {
                revert(0, returndatasize())
            }
            default {
                return(0, returndatasize())
            }
        }
    }
}
