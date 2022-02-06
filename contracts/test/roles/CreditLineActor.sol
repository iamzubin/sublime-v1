pragma solidity 0.7.6;
pragma experimental ABIEncoderV2;

import "../../CreditLine/CreditLine.sol";
import "../Constants.sol";

import "../../interfaces/ICreditLine.sol";

contract CreditLineActor is Constants {

    function createRequest(address creditLineAddress, address receiver,
                            uint256 borrowLimit,
                            uint256 borrowRate,
                            bool autoLiquidation,
                            uint256 collateralRatio,
                            address borrowAsset,
                            address collateralAsset,
                            bool requestAsLender) public {
        ICreditLine creditLine = ICreditLine(creditLineAddress);

        creditLine.request(receiver,
        borrowLimit,
        borrowRate,
        autoLiquidation,
        collateralRatio,
        borrowAsset,
        collateralAsset,
        requestAsLender);
    }

    function cancelRequest(address creditLineAddress, uint256 id) public {
        ICreditLine creditLine = ICreditLine(creditLineAddress);

        creditLine.cancel(id);
    }

    function acceptRequest(address creditLineAddress, uint256 id) public {
        ICreditLine creditLine = ICreditLine(creditLineAddress);

        creditLine.accept(id);
    }

    function borrow(address creditLineAddress, uint256 id, uint256 amount) public {
        ICreditLine creditLine = ICreditLine(creditLineAddress);

        creditLine.borrow(id, amount);
    }

    function repay(address creditLineAddress, uint256 id, uint256 amount) public {
        ICreditLine creditLine = ICreditLine(creditLineAddress);

        creditLine.repay(id, amount);
    }

    function addCollateral(address creditLineAddress, uint256 id, uint256 amount, 
                            address strategy, bool fromSavingsAccount) public {
        ICreditLine creditLine = ICreditLine(creditLineAddress);

        creditLine.depositCollateral(id, amount, strategy, fromSavingsAccount);
    }

    function withdrawCollateral(address creditLineAddress, uint256 id, 
                                uint256 amount, bool toSavingsAccount) public {
        ICreditLine creditLine = ICreditLine(creditLineAddress);

        creditLine.withdrawCollateral(id, amount, toSavingsAccount);
    }

    function close(address creditLineAddress, uint256 id) public {
        ICreditLine creditLine = ICreditLine(creditLineAddress);
        
        creditLine.close(id);
    }

    function liquidate(address creditLineAddress, uint256 id, bool toSavingsAccount) public {
        ICreditLine creditLine = ICreditLine(creditLineAddress);

        creditLine.liquidate(id, toSavingsAccount);
    }

}