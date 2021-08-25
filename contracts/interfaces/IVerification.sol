// SPDX-License-Identifier: MIT
pragma solidity 0.7.0;

interface IVerification {
    function isUser(address _user, address _verifier) external view returns (bool);
}
