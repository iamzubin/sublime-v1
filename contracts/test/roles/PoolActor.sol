pragma solidity 0.7.6;

import "../../interfaces/IPool.sol";
import "../Constants.sol";

contract PoolActor is Constants {

    function depositCollateral(address poolAddress, uint256 amount,
                                bool transferFromSavingsAccount) public {
        IPool(poolAddress).depositCollateral(amount, transferFromSavingsAccount);
    }

}