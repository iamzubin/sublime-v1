// SPDX-License-Identifier: MIT
pragma solidity 0.7.6;

interface ICreditline {
    function depositCollateral(
        uint256 _id,
        uint256 _amount,
        address _strategy,
        bool _fromSavingsAccount
    ) external payable;

    function repay(
        uint256 _id,
        uint256 _amount,
        bool _fromSavingsAccount
    ) external payable;
}
