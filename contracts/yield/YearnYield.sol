// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.7.0;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";

import "../interfaces/IYield.sol";
import "../interfaces/Invest/IyVault.sol";

/**
 * @title Yield contract
 * @notice Implements the functions to lock/unlock tokens into YVault
 * @author Sublime
 **/
contract YearnYield is IYield, Initializable, OwnableUpgradeable {
    using SafeERC20 for IERC20;
    using SafeMath for uint256;

    address payable public savingsAccount;

    /**
     * @dev stores the address of contract to invest in
     */
    mapping(address => address) public override liquidityToken;

    modifier onlySavingsAccount {
        require(
            _msgSender() == savingsAccount,
            "Invest: Only savings account can invoke"
        );
        _;
    }

    function initialize(address _owner, address payable _savingsAccount)
        public
        initializer
    {
        __Ownable_init();
        super.transferOwnership(_owner);

        require(_savingsAccount != address(0), "Invest: zero address");
        savingsAccount = _savingsAccount;
    }

    function updateSavingsAccount(address payable _savingsAccount)
        external
        onlyOwner
    {
        require(_savingsAccount != address(0), "Invest: zero address");
        savingsAccount = _savingsAccount;
    }

    function updateProtocolAddresses(address asset, address to)
        external
        onlyOwner
    {
        require(to != address(0), "Invest: zero address");
        require(
            liquidityToken[asset] == address(0),
            "Invest: Cannot update existing address"
        );
        liquidityToken[asset] = to;
    }

    function emergencyWithdraw(address _asset, address payable _wallet)
        external
        onlyOwner
        returns (uint256 received)
    {
        address investedTo = liquidityToken[_asset];
        uint256 amount = IERC20(investedTo).balanceOf(address(this));

        if (_asset == address(0)) {
            received = _withdrawETH(investedTo, amount);
            _wallet.transfer(received);
        } else {
            received = _withdrawERC(_asset, investedTo, amount);
            IERC20(_asset).transfer(_wallet, received);
        }
    }

    /**
     * @dev Used to lock tokens in available protocol
     * @dev Asset Tokens to be locked must be approved to this contract by user
     * @param user the address of user
     * @param asset the address of token to invest
     * @param amount the amount of asset
     * @return investedTo address of liquidity token
     * @return sharesReceived amount of shares received
     **/
    function lockTokens(
        address user,
        address asset,
        uint256 amount
    )
        public
        payable
        override
        onlySavingsAccount
        returns (address investedTo, uint256 sharesReceived)
    {
        require(amount != 0, "Invest: amount");

        investedTo = liquidityToken[asset];
        if (asset == address(0)) {
            require(msg.value == amount, "Invest: ETH amount");
            sharesReceived = _depositETH(investedTo, amount);
        } else {
            IERC20(asset).safeTransferFrom(user, address(this), amount);
            sharesReceived = _depositERC20(asset, investedTo, amount);
        }

        emit LockedTokens(user, investedTo, sharesReceived);
    }

    /**
     * @dev Used to unlock tokens from available protocol
     * @param asset the address of underlying token
     * @param amount the amount of asset
     * @return received amount of tokens received
     **/
    function unlockTokens(address asset, uint256 amount)
        public
        override
        onlySavingsAccount
        returns (uint256 received)
    {
        require(amount != 0, "Invest: amount");
        address investedTo = liquidityToken[asset];

        if (asset == address(0)) {
            received = _withdrawETH(investedTo, amount);
            savingsAccount.transfer(received);
        } else {
            received = _withdrawERC(asset, investedTo, amount);
            IERC20(asset).transfer(savingsAccount, received);
        }

        emit UnlockedTokens(asset, received);
    }

    /**
     * @dev Used to get amount of underlying tokens for current number of shares
     * @param shares the amount of shares
     * @return amount amount of underlying tokens
     **/
    function getTokensForShares(uint256 shares, address asset)
        external
        view
        override
        returns (uint256 amount)
    {
        if (shares == 0) return 0;
        amount = IyVault(liquidityToken[asset])
            .getPricePerFullShare()
            .mul(shares)
            .div(1e18);
    }

    function _depositETH(address vault, uint256 amount)
        internal
        returns (uint256 sharesReceived)
    {
        uint256 initialTokenBalance = IERC20(vault).balanceOf(address(this));

        //mint vault
        IyVault(vault).depositETH{value: amount}();

        sharesReceived = IERC20(vault).balanceOf(address(this)).sub(
            initialTokenBalance
        );
    }

    function _depositERC20(
        address asset,
        address vault,
        uint256 amount
    ) internal returns (uint256 sharesReceived) {
        uint256 sharesBefore = IERC20(vault).balanceOf(address(this));

        //lock collateral in vault
        IERC20(asset).approve(vault, amount);
        IyVault(vault).deposit(amount);

        sharesReceived = IERC20(vault).balanceOf(address(this)).sub(
            sharesBefore
        );
    }

    function _withdrawETH(address vault, uint256 amount)
        internal
        returns (uint256 received)
    {
        uint256 ethBalance = address(this).balance;

        IyVault(vault).withdrawETH(amount);

        received = address(this).balance.sub(ethBalance);
    }

    function _withdrawERC(
        address asset,
        address vault,
        uint256 amount
    ) internal returns (uint256 tokensReceived) {
        uint256 initialAssetBalance = IERC20(asset).balanceOf(address(this));

        //withdraw collateral from vault
        IyVault(vault).withdraw(amount);

        tokensReceived = IERC20(asset).balanceOf(address(this)).sub(
            initialAssetBalance
        );
    }
}
