// SPDX-License-Identifier: MIT
pragma solidity 0.7.0;

interface IVerifier {
    function verify(address _user) external view returns (bool);
}
