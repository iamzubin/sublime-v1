// SPDX-License-Identifier: MIT
pragma solidity 0.7.6;

import '../interfaces/IWETH9.sol';
import '../interfaces/IPool.sol';
import '@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol';

contract PoolUtils {
    IWETH9 public immutable weth;
    address public immutable bin;

    constructor(address _weth, address _bin) {
        weth = IWETH9(_weth);
        bin = _bin;
    }

    function depositEthAsCollateralToPool(address _pool) external payable {
        _toWETHAndApprove(_pool, msg.value);
        IPool(_pool).depositCollateral(msg.value, false);
    }

    function addEthCollateralInMarginCall(address _pool, address _lender) external payable {
        _toWETHAndApprove(_pool, msg.value);
        _flushPoolTokensIfExists(_pool);
        IPool(_pool).addCollateralInMarginCall(_lender, msg.value, false);
    }

    function ethLend(
        address _pool,
        address _lender,
        address _strategy
    ) external payable {
        _toWETHAndApprove(_pool, msg.value);
        IPool(_pool).lend(_lender, msg.value, _strategy, false);
    }

    function _flushPoolTokensIfExists(address _pool) internal {
        uint256 poolTokens = IERC20Upgradeable(_pool).balanceOf(address(this));
        if (poolTokens > 0) {
            IERC20Upgradeable(_pool).transfer(bin, poolTokens);
        }
    }

    function _toWETHAndApprove(address _address, uint256 _amount) internal {
        weth.deposit{value: _amount}();
        weth.approve(_address, _amount);
    }
}
