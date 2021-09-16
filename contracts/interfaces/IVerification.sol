// SPDX-License-Identifier: MIT
pragma solidity 0.7.0;

interface IVerification {
    function isUser(address _user, address _verifier) external view returns (bool);

    function registerMasterAddress(address _masterAddress, bool _isMasterLinked) external;

    function unregisterMasterAddress(address _masterAddress, address _verifier) external;
}
