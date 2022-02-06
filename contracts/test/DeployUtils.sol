// SPDX-License-Identifier: MIT
pragma solidity 0.7.6;

import "ds-test/test.sol";

import '@openzeppelin/contracts/token/ERC20/SafeERC20.sol';
import '@openzeppelin/contracts/math/SafeMath.sol';
import '@openzeppelin/contracts/utils/ReentrancyGuard.sol';
import '@openzeppelin/contracts-upgradeable/proxy/Initializable.sol';
import '@openzeppelin/contracts-upgradeable/token/ERC20/ERC20PausableUpgradeable.sol';

import "./Constants.sol";

//interface Hevm {
//    function warp(uint256) external;
//    function store(address,bytes32,bytes32) external;
//}

contract DeployUtils is DSTest, Constants {
    using SafeERC20 for IERC20;
    using SafeMath for uint256;

//    Hevm hevm;

//    constructor() public { hevm = Hevm(address(bytes20(uint160(uint256(keccak256("hevm cheat code")))))); }

//    function mint(address token, address account, uint256 amt) public {
//        address addr = token;
//        uint256 slot  = balanceSlot[token];
//        uint256 bal = IERC20(addr).balanceOf(account);
//
//        hevm.store(
//            addr,
//            keccak256(abi.encode(account, slot)), // Mint tokens
//            bytes32(bal + amt)
//        );
//
//        assertEq(IERC20(addr).balanceOf(account), bal + amt); // Assert new balance
//    }
}