pragma solidity 0.7.6;

import "./Constants.sol";

contract Scenarios is Constants {
    struct CreditLineRequestVars {
        uint256 borrowLimit;
        uint256 borrowRate;
        bool autoLiquidation;
        uint256 collateralRatio;
        address borrowAsset;
        address collateralAsset;
        bool requestAsLender;
    }

    struct PoolFactoryDeploymentVars {
        uint256 collectionPeriod;
        uint256 loanWithdrawalDuration;
        uint256 marginCallDuration;
        bytes4 poolInitFuncSelector;
        uint256 liquidatorRewardFraction;
        uint256 poolCancelPenaltyMultiple;
        uint256 minBorrowFraction;
        uint256 protocolFeeFraction;
        address protocolFeeCollector;
        address noStrategy;
    }

    CreditLineRequestVars CreditLine_1 = CreditLineRequestVars(1e31, //borrowLimit
                                                                1e29, //borrowRate
                                                                false, //autoLiquidation
                                                                1e30, //collateralRatio
                                                                DAI, //borrowAsset
                                                                WETH, //collateralAsset
                                                                false); //requestAsLender
                                        
}