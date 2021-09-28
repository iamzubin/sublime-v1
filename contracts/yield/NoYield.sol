// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.7.0;

import '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';
import '@openzeppelin/contracts/utils/ReentrancyGuard.sol';
import '@openzeppelin/contracts/token/ERC20/SafeERC20.sol';
import '@openzeppelin/contracts/math/SafeMath.sol';

import '../interfaces/IYield.sol';
import '../interfaces/Invest/ICEther.sol';
import '../interfaces/Invest/ICToken.sol';

/**
 * @title Yield contract
 * @notice Implements the functions to lock/unlock tokens into available exchanges
 * @author Sublime
 **/
contract NoYield is IYield, Initializable, OwnableUpgradeable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using SafeMath for uint256;

    address payable public savingsAccount;

    function initialize(address _owner, address payable _savingsAccount) public initializer {
        __Ownable_init();
        super.transferOwnership(_owner);

        _updateSavingsAccount(_savingsAccount);
    }

    function liquidityToken(address asset) external view override returns (address tokenAddress) {
        tokenAddress = asset;
    }

    function updateSavingsAccount(address payable _savingsAccount) public onlyOwner {
        _updateSavingsAccount(_savingsAccount);
    }

    function _updateSavingsAccount(address payable _savingsAccount) internal {
        require(_savingsAccount != address(0), 'Invest: zero address');
        savingsAccount = _savingsAccount;
        emit SavingsAccountUpdated(_savingsAccount);
    }

    function emergencyWithdraw(address _asset, address payable _wallet) external onlyOwner returns (uint256 received) {
        uint256 amount = IERC20(_asset).balanceOf(address(this));
        IERC20(_asset).safeTransfer(_wallet, received);
        received = amount;
    }

    function lockTokens(
        address user,
        address asset,
        uint256 amount
    ) public payable override onlySavingsAccount nonReentrant returns (uint256 sharesReceived) {
        require(amount != 0, 'Invest: amount');
        IERC20(asset).safeTransferFrom(user, address(this), amount);
        sharesReceived = amount;
        emit LockedTokens(user, asset, sharesReceived);
    }

    function unlockTokens(address asset, uint256 amount) public override onlySavingsAccount nonReentrant returns (uint256 tokensReceived) {
        tokensReceived = _unlockTokens(asset, amount);
    }

    function unlockShares(address asset, uint256 amount) public override onlySavingsAccount nonReentrant returns (uint256 received) {
        received = _unlockTokens(asset, amount);
    }

    function _unlockTokens(address asset, uint256 amount) internal returns (uint256 received) {
        require(amount != 0, 'Invest: amount');
        received = amount;
        IERC20(asset).safeTransfer(savingsAccount, received);
        emit UnlockedTokens(asset, received);
    }

    function getTokensForShares(uint256 shares, address asset) external pure override returns (uint256 amount) {
        amount = shares;
    }

    function getSharesForTokens(uint256 amount, address asset) external pure override returns (uint256 shares) {
        shares = amount;
    }

    modifier onlySavingsAccount() {
        require(_msgSender() == savingsAccount, 'Invest: Only savings account can invoke');
        _;
    }
}
