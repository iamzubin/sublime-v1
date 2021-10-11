// SPDX-License-Identifier: MIT
pragma solidity 0.7.0;

interface IPoolFactory {
    function savingsAccount() external view returns (address);

    function owner() external view returns (address);

    function poolRegistry(address pool) external view returns (bool);

    function priceOracle() external view returns (address);

    function extension() external view returns (address);

    function repaymentImpl() external view returns (address);

    function userRegistry() external view returns (address);

    function collectionPeriod() external view returns (uint256);

    function loanWithdrawalDuration() external view returns (uint256);

    function marginCallDuration() external view returns (uint256);

    function minBorrowFraction() external view returns (uint256);

    function liquidatorRewardFraction() external view returns (uint256);

    function votingPassRatio() external view returns (uint256);

    function poolCancelPenaltyFraction() external view returns (uint256);

    function getProtocolFeeData() external view returns (uint256, address);
}
