// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.7.6;

import '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';
import '@openzeppelin/contracts/utils/ReentrancyGuard.sol';
import '@openzeppelin/contracts/token/ERC20/SafeERC20.sol';
import '@openzeppelin/contracts/math/SafeMath.sol';

import '../interfaces/IYield.sol';
import '../interfaces/Invest/ICEther.sol';
import '../interfaces/Invest/ICToken.sol';
import '../interfaces/Invest/Comptroller.sol';
import '../interfaces/IWETH9.sol';

/**
 * @title Yield contract
 * @notice Implements the functions to lock/unlock tokens into available exchanges
 * @author Sublime
 **/
contract CompoundYield is IYield, Initializable, OwnableUpgradeable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using SafeMath for uint256;

    /**
     * @notice stores the address of savings account contract
     **/
    address public savingsAccount;

    /**
     * @notice stores the address of wrapped eth token
     **/
    address public immutable weth;

    /**
     * @notice the max amount that can be deposited for every token to the yield contract
     */
    mapping(address => uint256) public depositLimit;

    /**
     * @notice stores the address of liquidity token for a given base token
     */
    mapping(address => address) public override liquidityToken;

    /**
     * @notice emitted when liquidity token address of an asset is updated
     * @param asset the address of asset
     * @param protocolToken address of the liquidity token for the asset
     **/
    event ProtocolAddressesUpdated(address indexed asset, address indexed protocolToken);

    constructor(address _weth) {
        weth = _weth;
    }

    /**
     * @notice checks if contract is invoked by savings account
     **/
    modifier onlySavingsAccount() {
        require(msg.sender == savingsAccount, 'Invest: Only savings account can invoke');
        _;
    }

    /**
     * @notice used to initialize the variables in the contract
     * @dev can only be called once
     * @param _owner address of the owner
     * @param _savingsAccount address of the savings account contract
     **/
    function initialize(address _owner, address _savingsAccount) external initializer {
        __Ownable_init();
        super.transferOwnership(_owner);
        _updateSavingsAccount(_savingsAccount);
    }

    /**
     * @notice used to update savings account contract address
     * @dev can only be called by owner
     * @param _savingsAccount address of updated savings account contract
     **/
    function updateSavingsAccount(address _savingsAccount) external onlyOwner {
        _updateSavingsAccount(_savingsAccount);
    }

    function _updateSavingsAccount(address _savingsAccount) internal {
        require(_savingsAccount != address(0), 'Invest: zero address');
        savingsAccount = _savingsAccount;
        emit SavingsAccountUpdated(_savingsAccount);
    }

    /**
     * @notice used to update liquidity token for a asset
     * @dev can only be called by owner
     * @param _asset address of the token
     * @param _liquidityToken address of the liquidityToken for the given token
     **/
    function updateProtocolAddresses(address _asset, address _liquidityToken) external onlyOwner {
        require(_liquidityToken != address(0), "Liquidity token of asset can't be zero");
        liquidityToken[_asset] = _liquidityToken;
        emit ProtocolAddressesUpdated(_asset, _liquidityToken);
    }

    /**
     * @notice used to withdraw all tokens of a type in case of emergencies
     * @dev only owner can withdraw
     * @param _asset address of the token being withdrawn
     * @param _wallet address to which tokens are withdrawn
     * @param _amount amount to be withdraw. (if 0, it means all amount)
     */
    function emergencyWithdraw(
        address _asset,
        address payable _wallet,
        uint256 _amount
    ) external onlyOwner returns (uint256) {
        require(_wallet != address(0), 'cant burn');
        address investedTo = liquidityToken[_asset];
        uint256 received;
        uint256 amount = _amount;
        
        if (_amount == 0) {
            amount = IERC20(investedTo).balanceOf(address(this));
        }

        if (_asset == weth) {
            received = _withdrawETH(investedTo, amount);
            IWETH9(weth).deposit{value: received}();
        } else {
            received = _withdrawERC(_asset, investedTo, amount);
        }
        IERC20(_asset).safeTransfer(_wallet, received);
        return received;
    }

    /**
     * @notice withdraw the comp tokens supplied
     * @dev only owner can call
     * @param _comptroller address of the comptroller contract
     * @param _compToken address of the comp token
     * @param _receiver address of the receiver
     */
    function claimCompTokens(
        address _comptroller,
        address _compToken,
        address _receiver
    ) external onlyOwner returns (uint256) {
        Comptroller(_comptroller).claimComp(address(this));
        uint256 compBalance = IERC20(_compToken).balanceOf(address(this));
        IERC20(_compToken).transfer(_receiver, compBalance);
        return compBalance;
    }

    /**
     * @notice Used to lock tokens in available protocol
     * @dev Asset Tokens to be locked must be approved to this contract by user
     * @param user the address of user
     * @param asset the address of token to invest
     * @param amount the amount of asset
     * @return sharesReceived amount of shares received
     **/
    function lockTokens(
        address user,
        address asset,
        uint256 amount
    ) external override onlySavingsAccount nonReentrant returns (uint256) {
        require(amount != 0, 'Invest: amount');
        uint256 sharesReceived;
        address investedTo = liquidityToken[asset];
        IERC20(asset).safeTransferFrom(user, address(this), amount);
        if (asset == weth) {
            IWETH9(weth).withdraw(amount);
            sharesReceived = _depositETH(investedTo, amount);
        } else {
            sharesReceived = _depositERC20(asset, investedTo, amount);
        }
        emit LockedTokens(user, investedTo, sharesReceived);
        return sharesReceived;
    }

    /**
     * @notice Used to unlock tokens from available protocol
     * @param asset the address of share token
     * @param amount the amount of asset
     * @return amount of tokens received
     **/
    function unlockTokens(address asset, uint256 amount) external override onlySavingsAccount nonReentrant returns (uint256) {
        require(amount != 0, 'Invest: amount');
        address investedTo = liquidityToken[asset];
        uint256 received;
        if (asset == weth) {
            received = _withdrawETH(investedTo, amount);
            IWETH9(weth).deposit{value: received}();
        } else {
            received = _withdrawERC(asset, investedTo, amount);
        }
        IERC20(asset).safeTransfer(savingsAccount, received);

        emit UnlockedTokens(asset, received);
        return received;
    }

    /**
     * @notice Used to unlock shares
     * @param asset the address of underlying token
     * @param amount the amount of shares to unlock
     * @return received amount of shares received
     **/
    function unlockShares(address asset, uint256 amount) external override onlySavingsAccount nonReentrant returns (uint256) {
        if (amount == 0) {
            return 0;
        }

        IERC20(asset).safeTransfer(savingsAccount, amount);

        emit UnlockedShares(asset, amount);
        return amount;
    }

    /**
     * @dev Used to get amount of underlying tokens for given number of shares
     * @param shares the amount of shares
     * @param asset the address of token locked
     * @return amount of underlying tokens
     **/
    function getTokensForShares(uint256 shares, address asset) public override returns (uint256) {
        //balanceOfUnderlying returns underlying balance for total shares
        if (shares == 0) return 0;
        address cToken = liquidityToken[asset];
        uint256 amount = ICToken(cToken).balanceOfUnderlying(address(this)).mul(shares).div(IERC20(cToken).balanceOf(address(this)));
        return amount;
    }

    /**
     * @notice Used to get number of shares from an amount of underlying tokens
     * @param amount the amount of tokens
     * @param asset the address of token
     * @return amount of shares for given tokens
     **/
    function getSharesForTokens(uint256 amount, address asset) external override returns (uint256) {
        return (amount.mul(1e18)).div(getTokensForShares(1e18, asset));
    }

    function _depositETH(address cToken, uint256 amount) internal returns (uint256) {
        uint256 initialCTokenBalance = IERC20(cToken).balanceOf(address(this));
        //mint cToken
        ICEther(cToken).mint{value: amount}();

        uint256 latterCTokenBalance = IERC20(cToken).balanceOf(address(this));
        require(depositLimit[cToken] > latterCTokenBalance, "Can't deposit more than permissible limit");
        sharesReceived = latterCTokenBalance.sub(initialCTokenBalance);
        return sharesReceived;
    }

    function _depositERC20(
        address asset,
        address cToken,
        uint256 amount
    ) internal returns (uint256) {
        uint256 initialCTokenBalance = IERC20(cToken).balanceOf(address(this));
        //mint cToken
        IERC20(asset).approve(cToken, 0);
        IERC20(asset).approve(cToken, amount);
        require(ICToken(cToken).mint(amount) == 0, 'Error in minting tokens');

        uint256 latterCTokenBalance = IERC20(cToken).balanceOf(address(this));
        require(depositLimit[cToken] > latterCTokenBalance, "Can't deposit more than permissible limit");
        sharesReceived = latterCTokenBalance.sub(initialCTokenBalance);
        return sharesReceived;
    }

    function _withdrawETH(address cToken, uint256 amount) internal returns (uint256) {
        uint256 ethBalance = address(this).balance;

        require(ICToken(cToken).redeem(amount) == 0, 'Error in unwrapping');

        return (address(this).balance.sub(ethBalance));
    }

    function _withdrawERC(
        address asset,
        address cToken,
        uint256 amount
    ) internal returns (uint256) {
        uint256 initialAssetBalance = IERC20(asset).balanceOf(address(this));
        require(ICToken(cToken).redeem(amount) == 0, 'Error in unwrapping');
        uint256 tokensReceived = IERC20(asset).balanceOf(address(this)).sub(initialAssetBalance);
        return tokensReceived;
    }

    function setDepositLimit(address asset, uint256 limit) external onlyOwner {
        depositLimit[asset] = limit;
    }

    //to apply check
    receive() external payable {}
}
