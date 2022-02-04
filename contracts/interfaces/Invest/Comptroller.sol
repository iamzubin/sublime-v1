// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.7.6;

interface Comptroller {
    function claimComp(address) external;

    function compSpeeds(address _cToken) external view returns (uint256);

    function compSupplySpeeds(address _cToken) external view returns (uint256);

    function claimComp(
        address[] calldata holders,
        address[] calldata cTokens,
        bool borrowers,
        bool suppliers
    ) external;
}
