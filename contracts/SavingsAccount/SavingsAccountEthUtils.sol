// SPDX-License-Identifier: MIT
pragma solidity 0.7.6;

import '../interfaces/IWETH9.sol';
import '../interfaces/ISavingsAccount.sol';
import '@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol';

contract SavingsAccountEthUtils {
    IWETH9 public immutable weth;
    ISavingsAccount public immutable savingsAccount;

    constructor(address _weth, address _savingsAccount) {
        weth = IWETH9(_weth);
        savingsAccount = ISavingsAccount(_savingsAccount);
    }

    function depositEth(address _strategy) external payable {
        require(msg.value > 0, 'Should deposit more than 0');
        _toWETHAndApprove(address(savingsAccount), msg.value);
        savingsAccount.deposit(address(weth), _strategy, msg.sender, msg.value);
    }

    function _toWETHAndApprove(address _address, uint256 _amount) internal {
        weth.deposit{value: _amount}();
        weth.approve(_address, _amount);
    }
}
