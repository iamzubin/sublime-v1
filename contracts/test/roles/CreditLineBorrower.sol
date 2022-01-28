pragma solidity 0.7.0;

import "../../CreditLine/CreditLine.sol";
import "../Constants.sol";

contract CreditLineBorrower is Constants {

    function createRequest(CreditLine creditLineObj, address receiver,
                            CreditLineRequestVars creditLineVars) public {
        creditLineObj.request(receiver,
                            creditLineVars.borrowLimit,
                            creditLineVars.borrowRate,
                            creditLineVars.autoLiquidation,
                            creditLineVars.collateralRatio,
                            creditLineVars.borrowAsset,
                            creditLineVars.collateralAsset,
                            creditLineVars.requestAsLender);
    }

    function cancelRequest(CreditLine creditLineObj, uint256 id) public {
        creditLineObj.cancel(id);
    }

    function acceptRequest(CreditLine creditLineObj, uint256 id) public {
        creditLineObj.accept(id);
    }

    function borrow(CreditLine creditLineObj, uint256 id, uint256 amount) public {
        creditLineObj.borrow(id, amount);
    }

    function repay(CreditLine creditLineObj, uint256 id, uint256 amount, 
                    bool fromSavingsAccount) public {
        creditLineObj.repay(id, amount, fromSavingsAccount);
    }

    function addCollateral(CreditLine creditLineObj, uint256 id, uint256 amount, 
                            address strategy, bool fromSavingsAccount) public {
        creditLineObj.depositCollateral(id, amount, strategy, fromSavingsAccount);
    }

    function withdrawCollateral(CreditLine creditLineObj, uint256 id, 
                                uint256 amount, bool toSavingsAccount) public {
        creditLineObj.withdrawCollateral(id, amount, toSavingsAccount);
    }

    function close(CreditLine creditLineObj, uint256 id) public {
        creditLineObj.close(id);
    }

}