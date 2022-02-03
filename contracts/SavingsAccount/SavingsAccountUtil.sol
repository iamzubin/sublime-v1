// SPDX-License-Identifier: MIT
pragma solidity 0.7.6;

import '../interfaces/ISavingsAccount.sol';
import '@openzeppelin/contracts/token/ERC20/SafeERC20.sol';
import '@openzeppelin/contracts/utils/ReentrancyGuard.sol';

library SavingsAccountUtil {
    using SafeERC20 for IERC20;

    function depositFromSavingsAccount(
        ISavingsAccount _savingsAccount,
        address _token,
        address _strategy,
        address _from,
        address _to,
        uint256 _amount,
        bool _withdrawShares,
        bool _toSavingsAccount
    ) internal returns (uint256) {
        if (_toSavingsAccount) {
            return savingsAccountTransfer(_savingsAccount, _token, _strategy, _from, _to, _amount);
        } else {
            return withdrawFromSavingsAccount(_savingsAccount, _token, _strategy, _from, _to, _amount, _withdrawShares);
        }
    }

    function directDeposit(
        ISavingsAccount _savingsAccount,
        address _token,
        address _strategy,
        address _from,
        address _to,
        uint256 _amount,
        bool _toSavingsAccount
    ) internal returns (uint256) {
        if (_toSavingsAccount) {
            return directSavingsAccountDeposit(_savingsAccount, _token, _strategy, _from, _to, _amount);
        } else {
            return transferTokens(_token, _from, _to, _amount);
        }
    }

    function directSavingsAccountDeposit(
        ISavingsAccount _savingsAccount,
        address _token,
        address _strategy,
        address _from,
        address _to,
        uint256 _amount
    ) internal returns (uint256) {
        transferTokens(_token, _from, address(this), _amount);
        address _approveTo = _strategy;
        if (_strategy == address(0)) {
            _approveTo = address(_savingsAccount);
        }
        IERC20(_token).safeApprove(_approveTo, _amount);
        uint256 _sharesReceived = _savingsAccount.deposit(_token, _strategy, _to, _amount);
        return _sharesReceived;
    }

    function savingsAccountTransferShares(
        ISavingsAccount _savingsAccount,
        address _from,
        address _to,
        uint256 _shares,
        address _token,
        address _strategy
    ) internal returns (uint256) {
        if (_from == address(this)) {
            _savingsAccount.transferShares(_shares, _token, _strategy, _to);
        } else {
            _savingsAccount.transferSharesFrom(_shares, _token, _strategy, _from, _to);
        }
        return _shares;
    }

    function savingsAccountTransfer(
        ISavingsAccount _savingsAccount,
        address _token,
        address _strategy,
        address _from,
        address _to,
        uint256 _amount
    ) internal returns (uint256) {
        if (_from == address(this)) {
            _savingsAccount.transfer(_token, _strategy, _to, _amount);
        } else {
            _savingsAccount.transferFrom(_token, _strategy, _from, _to, _amount);
        }
        return _amount;
    }

    function withdrawFromSavingsAccount(
        ISavingsAccount _savingsAccount,
        address _token,
        address _strategy,
        address _from,
        address _to,
        uint256 _amount,
        bool _withdrawShares
    ) internal returns (uint256) {
        uint256 _amountReceived;
        if (_from == address(this)) {
            _amountReceived = _savingsAccount.withdraw(_token, _strategy, payable(_to), _amount, _withdrawShares);
        } else {
            _amountReceived = _savingsAccount.withdrawFrom(_token, _strategy, _from, payable(_to), _amount, _withdrawShares);
        }
        return _amountReceived;
    }

    function transferTokens(
        address _token,
        address _from,
        address _to,
        uint256 _amount
    ) internal returns (uint256) {
        if (_amount == 0) {
            return 0;
        }
        if (_from == address(this)) {
            IERC20(_token).safeTransfer(_to, _amount);
        } else {
            //pool
            IERC20(_token).safeTransferFrom(_from, _to, _amount);
        }
        return _amount;
    }
}
