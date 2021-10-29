// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.7.0;
pragma experimental ABIEncoderV2;

interface IRepayment {
    /// @notice Event emitted when interest for the loann is partially repaid
    /// @param poolID The address of the pool to which interest was paid
    /// @param repayAmount Amount being repayed
    event InterestRepaid(address indexed poolID, uint256 repayAmount);

    /// @notice Event emitted when all interest for the pool is repaid
    /// @param poolID The address of the pool to which interest was paid
    /// @param repayAmount Amount being repayed
    event InterestRepaymentComplete(address indexed poolID, uint256 repayAmount);

    /// @notice Event emitted when pricipal is repaid
    /// @param poolID The address of the pool to which principal was paid
    /// @param repayAmount Amount being repayed
    event PrincipalRepaid(address indexed poolID, uint256 repayAmount);

    /// @notice Event emitted when Grace penalty and interest for previous period is completely repaid
    /// @param poolID The address of the pool to which repayment was made
    /// @param repayAmount Amount being repayed
    event GracePenaltyRepaid(address indexed poolID, uint256 repayAmount);

    /// @notice Event emitted when repayment for extension is partially done
    /// @param poolID The address of the pool to which the partial repayment was made
    /// @param repayAmount Amount being repayed
    event PartialExtensionRepaid(address indexed poolID, uint256 repayAmount);

    /// @notice Event emitted when repayment for extension is completely done
    /// @param poolID The address of the pool to which interest was paid
    /// @param repayAmount Amount being re-payed by the borrower
    event ExtensionRepaymentComplete(address indexed poolID, uint256 repayAmount); // Made during current period interest repayment

    /// @notice Event to denote changes in the configurations of the pool factory
    event PoolFactoryUpdated(address indexed poolFactory);

    /// @notice Event to denote changes in the configurations of the Grace Penalty Rate
    event GracePenaltyRateUpdated(uint256 indexed gracePenaltyRate);

    /// @notice Event to denote changes in the configurations of the Grace Period Fraction
    event GracePeriodFractionUpdated(uint256 indexed gracePeriodFraction);

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
