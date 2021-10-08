// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.7.0;

interface IPool {
    function getLoanStatus() external view returns (uint256);

    function depositCollateral(uint256 _amount, bool _transferFromSavingsAccount) external payable;

    function addCollateralInMarginCall(
        address _lender,
        uint256 _amount,
        bool _isDirect
    ) external payable;

    function withdrawBorrowedAmount() external;

    function setConstants(address _lenderVerifier) external;

    function borrower() external returns (address);

    function getMarginCallEndTime(address _lender) external returns (uint256);

    function getBalanceDetails(address _lender) external view returns (uint256, uint256);

    function getTokensLent() external view returns (uint256);

    function closeLoan() external payable;
}
