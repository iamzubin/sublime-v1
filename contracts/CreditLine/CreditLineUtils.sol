// SPDX-License-Identifier: MIT
pragma solidity 0.7.6;

import '../interfaces/IWETH9.sol';
import '../interfaces/ICreditLine.sol';

contract CreditLineUtils {
    IWETH9 public immutable weth;
    ICreditline public immutable creditlines;

    constructor(address _weth, address _creditLines) {
        weth = IWETH9(_weth);
        creditlines = ICreditline(_creditLines);
    }

    function depositEthAsCollateralToCreditLine(uint256 _id, address _strategy) external payable {
        require(msg.value > 0, 'Should deposit non-zero value');
        weth.deposit{value: msg.value}();
        weth.approve(address(creditlines), msg.value);
        creditlines.depositCollateral(_id, msg.value, _strategy, false);
    }

    function repayEthToCreditLines(uint256 _id) external payable {
        require(msg.value > 0, 'Should repay non-zero value');
        weth.deposit{value: msg.value}();
        weth.approve(address(creditlines), msg.value);
        creditlines.repay(_id, msg.value, false);
    }
}
