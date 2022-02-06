// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.7.6;

interface ICreditLine {
    
    function updateDefaultStrategy(address _defaultStrategy) external;

    function updatePriceOracle(address _priceOracle) external;

    function updateSavingsAccount(address _savingsAccount) external;

    function updateProtocolFeeFraction(uint256 _protocolFee) external;

    function updateProtocolFeeCollector(address _protocolFeeCollector) external;

    function updateStrategyRegistry(address _strategyRegistry) external;

    function updateLiquidatorRewardFraction(uint256 _rewardFraction) external;

    function request(
        address _requestTo,
        uint256 _borrowLimit,
        uint256 _borrowRate,
        bool _autoLiquidation,
        uint256 _collateralRatio,
        address _borrowAsset,
        address _collateralAsset,
        bool _requestAsLender
    ) external returns (uint256);

    function accept(uint256 _id) external;

    function depositCollateral(
        uint256 _id,
        uint256 _amount,
        address _strategy,
        bool _fromSavingsAccount
    ) external payable;

    function borrow(uint256 _id, uint256 _amount) external;

    function repay(
        uint256 _id,
        uint256 _amount
    ) external payable;

    function close(uint256 _id) external;

    function cancel(uint256 _id) external;

    function withdrawCollateral(
        uint256 _id,
        uint256 _amount,
        bool _toSavingsAccount
    ) external;

    function liquidate(uint256 _id, bool _toSavingsAccount) external payable;

    function updateBorrowLimitLimits(uint256 _min, uint256 _max) external;

    function updateIdealCollateralRatioLimits(uint256 _min, uint256 _max) external;
    
    function updateBorrowRateLimits(uint256 _min, uint256 _max) external;
}
