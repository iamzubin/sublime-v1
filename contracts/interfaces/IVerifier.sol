// SPDX-License-Identifier: MIT
pragma solidity 0.7.0;

interface IVerifier {
    event UserRegistered(address user, bool isMasterLinked, string metadata);
    event UserUnregistered(address user);
}
