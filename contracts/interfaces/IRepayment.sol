// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.7.0;
pragma experimental ABIEncoderV2;

interface IRepayment {
    function initializeRepayment(
        uint256 numberOfTotalRepayments,
        uint256 repaymentInterval,
        uint256 borrowRate,
        uint256 loanStartTime,
        address lentAsset
    ) external;

    function getTotalRepaidAmount(address poolID) external view returns (uint256);

    function getInterestCalculationVars(address poolID) external view returns (uint256, uint256);

    function getCurrentLoanInterval(address poolID) external view returns (uint256);

    function instalmentDeadlineExtended(address _poolID, uint256 _period) external;

    function didBorrowerDefault(address _poolID) external view returns (bool);

    function getGracePeriodFraction() external view returns (uint256);

    function getNextInstalmentDeadline(address _poolID) external view returns (uint256);
}
