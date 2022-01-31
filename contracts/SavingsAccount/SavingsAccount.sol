// SPDX-License-Identifier: MIT
pragma solidity 0.7.6;

import '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';
import '@openzeppelin/contracts/utils/ReentrancyGuard.sol';
import '@openzeppelin/contracts/token/ERC20/SafeERC20.sol';
import '@openzeppelin/contracts/math/SafeMath.sol';
import '../interfaces/ISavingsAccount.sol';
import '../interfaces/IStrategyRegistry.sol';
import '../interfaces/IYield.sol';

/**
 * @title Savings account contract with Methods related to savings account
 * @notice Implements the functions related to savings account
 * @author Sublime
 **/
contract SavingsAccount is ISavingsAccount, Initializable, OwnableUpgradeable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using SafeMath for uint256;

    /**
     * @notice address of the strategy registry used to whitelist strategies
     */
    address public strategyRegistry;

    /**
     * @notice address of the credit lines contract
     */
    address public creditLine;

    /**
     * @notice mapping from user to token to strategy to balance of shares
     * @dev user -> token -> strategy (underlying address) -> amount (shares)
     */
    mapping(address => mapping(address => mapping(address => uint256))) public override balanceInShares;

    /**
     * @notice mapping from user to token to toAddress for approval to amount approved
     * @dev user => token => to => amount
     */
    mapping(address => mapping(address => mapping(address => uint256))) public allowance;

    /**
     * @notice modifier to check if address is the credit line
     * @param _caller address to check if credit line
     */
    modifier onlyCreditLine(address _caller) {
        require(_caller == creditLine, 'Invalid caller');
        _;
    }

    /**
     * @dev initialize the contract
     * @param _owner address of the owner of the savings account contract
     * @param _strategyRegistry address of the strategy registry
     * @param _creditLine address of the credit line contract
     **/
    function initialize(
        address _owner,
        address _strategyRegistry,
        address _creditLine
    ) external initializer {
        __Ownable_init();
        super.transferOwnership(_owner);

        _updateCreditLine(_creditLine);
        _updateStrategyRegistry(_strategyRegistry);
    }

    /**
     * @notice used to update credit line contract address
     * @dev only owner can update
     * @param _creditLine updated address of credit lines
     */
    function updateCreditLine(address _creditLine) external onlyOwner {
        _updateCreditLine(_creditLine);
    }

    function _updateCreditLine(address _creditLine) internal {
        require(_creditLine != address(0), 'SavingsAccount::initialize zero address');
        creditLine = _creditLine;
        emit CreditLineUpdated(_creditLine);
    }

    /**
     * @notice used to update strategy registry address
     * @dev only owner can update
     * @param _strategyRegistry updated address of strategy registry
     */
    function updateStrategyRegistry(address _strategyRegistry) external onlyOwner {
        _updateStrategyRegistry(_strategyRegistry);
    }

    function _updateStrategyRegistry(address _strategyRegistry) internal {
        require(_strategyRegistry != address(0), 'SavingsAccount::updateStrategyRegistry zero address');
        strategyRegistry = _strategyRegistry;
        emit StrategyRegistryUpdated(_strategyRegistry);
    }

    /**
     * @notice used to deposit tokens into strategy via savings account
     * @dev if token is address(0), then it is Ether
     * @param _amount amount of tokens deposited
     * @param _token address of token contract
     * @param _strategy address of the strategy into which tokens are to be deposited
     * @param _to address to deposit to
     */
    function deposit(
        uint256 _amount,
        address _token,
        address _strategy,
        address _to
    ) external override nonReentrant returns (uint256) {
        require(_to != address(0), 'SavingsAccount::deposit receiver address should not be zero address');
        require(_amount != 0, 'SavingsAccount::_deposit Amount must be greater than zero');
        require(IStrategyRegistry(strategyRegistry).registry(_strategy), 'SavingsAccount::deposit strategy do not exist');

        uint256 _sharesReceived = _deposit(_amount, _token, _strategy);
        balanceInShares[_to][_token][_strategy] = balanceInShares[_to][_token][_strategy].add(_sharesReceived);
        emit Deposited(_to, _sharesReceived, _token, _strategy);
        return _sharesReceived;
    }

    function _deposit(
        uint256 _amount,
        address _token,
        address _strategy
    ) internal returns (uint256 _sharesReceived) {
        _sharesReceived = _depositToYield(_amount, _token, _strategy);
    }

    function _depositToYield(
        uint256 _amount,
        address _token,
        address _strategy
    ) internal returns (uint256 _sharesReceived) {
        require(IStrategyRegistry(strategyRegistry).registry(_strategy), 'SavingsAccount::deposit strategy do not exist');
        if(Address(_token) != Address(0)) {
            require(msg.value == 0, '_depositToYield: ETH is not required for this operation');
        }
        _sharesReceived = IYield(_strategy).lockTokens(msg.sender, _token, _amount);
    }

    /**
     * @dev Used to switch saving strategy of an _token
     * @param _currentStrategy initial strategy of token
     * @param _newStrategy new strategy to invest
     * @param _token address of the token
     * @param _amount amount of tokens to be reinvested
     */
    function switchStrategy(
        uint256 _amount,
        address _token,
        address _currentStrategy,
        address _newStrategy
    ) external override nonReentrant {
        require(_currentStrategy != _newStrategy, 'SavingsAccount::switchStrategy Same strategy');
        require(IStrategyRegistry(strategyRegistry).registry(_newStrategy), 'SavingsAccount::_newStrategy do not exist');
        require(_amount != 0, 'SavingsAccount::switchStrategy Amount must be greater than zero');
        require(IStrategyRegistry(strategyRegistry).registry(_newStrategy), 'SavingsAccount::deposit strategy do not exist');

        _amount = IYield(_currentStrategy).getSharesForTokens(_amount, _token);

        balanceInShares[msg.sender][_token][_currentStrategy] = balanceInShares[msg.sender][_token][_currentStrategy].sub(
            _amount,
            'SavingsAccount::switchStrategy Insufficient balance'
        );

        uint256 _tokensReceived = IYield(_currentStrategy).unlockTokens(_token, _amount);

        IERC20(_token).safeApprove(_newStrategy, _tokensReceived);

        uint256 _sharesReceived = IYield(_newStrategy).lockTokens(address(this), _token, _tokensReceived);

        balanceInShares[msg.sender][_token][_newStrategy] = balanceInShares[msg.sender][_token][_newStrategy].add(_sharesReceived);
        emit StrategySwitched(msg.sender, _token, _amount, _sharesReceived, _currentStrategy, _newStrategy);
    }

    /**
     * @dev Used to withdraw token from Saving Account
     * @param _to address to which token should be sent
     * @param _amount amount of tokens to withdraw
     * @param _token address of the token to be withdrawn
     * @param _strategy strategy from where token has to withdrawn(ex:- compound,Aave etc)
     * @param _withdrawShares boolean indicating to withdraw in liquidity share or underlying token
     */
    function withdraw(
        uint256 _amount,
        address _token,
        address _strategy,
        address _to,
        bool _withdrawShares
    ) external override nonReentrant returns (uint256) {
        require(_amount != 0, 'SavingsAccount::withdraw Amount must be greater than zero');
        require(_to != address(0), "SavingsAccount::withdraw _to address should be nonz-zero");

        _amount = IYield(_strategy).getSharesForTokens(_amount, _token);

        balanceInShares[msg.sender][_token][_strategy] = balanceInShares[msg.sender][_token][_strategy].sub(
            _amount,
            'SavingsAccount::withdraw Insufficient amount'
        );

        (, uint256 _amountReceived) = _withdraw(_amount, _token, _strategy, _to, _withdrawShares);

        emit Withdrawn(msg.sender, _to, _amount, _token, _strategy, _withdrawShares);
        return _amountReceived;
    }

    /**
     * @dev Used to withdraw token from allowance of Saving Account
     * @param _from address from which tokens will be withdrawn
     * @param _to address to which token should be withdrawn
     * @param _amount amount of tokens to withdraw
     * @param _token address of the token to be withdrawn
     * @param _strategy strategy from where token has to withdrawn(ex:- compound,Aave etc)
     * @param _withdrawShares boolean indicating to withdraw in liquidity share or underlying token
     */

    function withdrawFrom(
        uint256 _amount,
        address _token,
        address _strategy,
        address _from,
        address _to,
        bool _withdrawShares
    ) external override nonReentrant returns (uint256) {
        require(_amount != 0, 'SavingsAccount::withdrawFrom Amount must be greater than zero');
        require(_from != address(0), "SavingsAccount::withdrawFrom _from address should be non-zero");
        require(_to != address(0), "SavingsAccount::withdrawFrom _to address should be non-zero");

        allowance[_from][_token][msg.sender] = allowance[_from][_token][msg.sender].sub(
            _amount,
            'SavingsAccount::withdrawFrom allowance limit exceeding'
        );

        _amount = IYield(_strategy).getSharesForTokens(_amount, _token);

        balanceInShares[_from][_token][_strategy] = balanceInShares[_from][_token][_strategy].sub(
            _amount,
            'SavingsAccount::withdrawFrom insufficient balance'
        );
        (, uint256 _amountReceived) = _withdraw(_amount, _token, _strategy, _to, _withdrawShares);
        emit Withdrawn(_from, msg.sender, _amount, _token, _strategy, _withdrawShares);
        return _amountReceived;
    }

    function _withdraw(
        uint256 _amount,
        address _token,
        address _strategy,
        address _to,
        bool _withdrawShares
    ) internal returns (address _tokenReceived, uint256 _amountReceived) {
        if (_withdrawShares) {
            (_amountReceived, _tokenReceived) = IYield(_strategy).unlockShares(_token, _amount);
        } else {
            _tokenReceived = _token;
            _amountReceived = IYield(_strategy).unlockTokens(_token, _amount);
        }
        _transfer(_amountReceived, _tokenReceived, _to);
    }

    function _transfer(
        uint256 _amount,
        address _token,
        address _to
    ) internal {
        require(_to != address(0), "SavingsAccounts::_transfer _to address should be non-zero");
        if (_token == address(0)) {
            (bool _success, ) = _to.call{value: _amount}('');
            require(_success, 'Transfer failed');
        } else {
            IERC20(_token).safeTransfer(_to, _amount);
        }
    }

    /**
     * @notice used to withdraw a token from all strategies
     * @param _token address of token which is to be withdrawn
     */
    function withdrawAll(address _token) external override nonReentrant returns (uint256 _tokenReceived) {
        address[] memory _strategyList = IStrategyRegistry(strategyRegistry).getStrategies();

        for (uint256 i; i < _strategyList.length; ++i) {
            uint256 _amount = balanceInShares[msg.sender][_token][_strategyList[i]];
            if (_amount != 0 && _strategyList[i] != address(0)) {
                _amount = IYield(_strategyList[i]).unlockTokens(_token, _amount);
                _tokenReceived = _tokenReceived.add(_amount);
                delete balanceInShares[msg.sender][_token][_strategyList[i]];
            }
        }

        if (_tokenReceived == 0) return 0;

        _transfer(_tokenReceived, _token, msg.sender);

        emit WithdrawnAll(msg.sender, _tokenReceived, _token);
    }

    function withdrawAll(address _token, address _strategy) external override nonReentrant returns (uint256 _tokenReceived) {
        uint256 _sharesBalance = balanceInShares[msg.sender][_token][_strategy];

        if (_sharesBalance == 0) return 0;

        uint256 _amount = IYield(_strategy).unlockTokens(_token, _sharesBalance);

        delete balanceInShares[msg.sender][_token][_strategy];

        _transfer(_amount, _token, msg.sender);

        emit Withdrawn(msg.sender, msg.sender, _amount, _token, _strategy, false);
    }

    /**
     * @notice used to approve allowance to an address
     * @dev this is prone to race condition, hence increaseAllowance is recommended
     * @param _amount amount of tokens approved
     * @param _token address of token approved
     * @param _to address of the user approved to
     */
    function approve(
        uint256 _amount,
        address _token,
        address _to
    ) external override {
        require(msg.sender != _to, 'SavingsAccount::can not approve same account');
        allowance[msg.sender][_token][_to] = _amount;

        emit Approved(_token, msg.sender, _to, _amount);
    }

    /**
     * @notice used to increase allowance to an address
     * @param _amount amount of tokens allowance is increased by
     * @param _token address of token approved
     * @param _to address of the address approved to
     */
    function increaseAllowance(
        uint256 _amount,
        address _token,
        address _to
    ) external override {
        uint256 _updatedAllowance = allowance[msg.sender][_token][_to].add(_amount);
        allowance[msg.sender][_token][_to] = _updatedAllowance;

        emit Approved(_token, msg.sender, _to, _updatedAllowance);
    }

    /**
     * @notice used to decrease allowance to an address
     * @param _amount amount of tokens allowance is decreased by
     * @param _token address of token approved
     * @param _to address of the user approved to
     */
    function decreaseAllowance(
        uint256 _amount,
        address _token,
        address _to
    ) external override {
        uint256 _updatedAllowance = allowance[msg.sender][_token][_to].sub(_amount);
        allowance[msg.sender][_token][_to] = _updatedAllowance;

        emit Approved(_token, msg.sender, _to, _updatedAllowance);
    }

    /**
     * @notice used by credit lines to replenish the allowance once the credit line pricinpal is repaid
     * @param _amount amount of tokens allowance is increased by
     * @param _token address of token approved
     * @param _from address of the lender of the credit line which is being replenished
     */
    function increaseAllowanceToCreditLine(
        uint256 _amount,
        address _token,
        address _from
    ) external override onlyCreditLine(msg.sender) {
        allowance[_from][_token][msg.sender] = allowance[_from][_token][msg.sender].add(_amount);

        emit CreditLineAllowanceRefreshed(_token, _from, msg.sender, _amount);
    }

    /**
     * @notice used to transfer tokens
     * @param _amount amount of tokens transferred
     * @param _token address of token transferred
     * @param _strategy address of the strategy from which tokens are transferred
     * @param _to address of the user tokens are transferred to
     */
    function transfer(
        uint256 _amount,
        address _token,
        address _strategy,
        address _to
    ) external override returns (uint256) {
        require(_amount != 0, 'SavingsAccount::transfer zero amount');
        require(_to != address(0), "SavingsAccount::transfer _to address should be non-zero");
        require(IStrategyRegistry(strategyRegistry).registry(_strategy), 'SavingsAccount::transfer strategy do not exist');

        _amount = IYield(_strategy).getSharesForTokens(_amount, _token);

        balanceInShares[msg.sender][_token][_strategy] = balanceInShares[msg.sender][_token][_strategy].sub(
            _amount,
            'SavingsAccount::transfer insufficient funds'
        );

        //update receiver's balance
        balanceInShares[_to][_token][_strategy] = balanceInShares[_to][_token][_strategy].add(_amount);

        emit Transfer(_token, _strategy, msg.sender, _to, _amount);

        return _amount;
    }

    /**
     * @notice used to transfer tokens from allowance by another address
     * @param _amount amount of tokens transferred
     * @param _token address of token transferred
     * @param _strategy address of the strategy from which tokens are transferred
     * @param _from address from whose allowance tokens are transferred
     * @param _to address of the user tokens are transferred to
     */
    function transferFrom(
        uint256 _amount,
        address _token,
        address _strategy,
        address _from,
        address _to
    ) external override {
        require(_amount != 0, 'SavingsAccount::transferFrom zero amount');
        require(_from != address(0), "SavingsAccount::transferFrom _from address should be non-zero");
        require(_to != address(0), "SavingsAccount::transferFrom _to address should be non-zero");
        require(IStrategyRegistry(strategyRegistry).registry(_strategy), 'SavingsAccount::transferFrom strategy do not exist');

        //update allowance
        allowance[_from][_token][msg.sender] = allowance[_from][_token][msg.sender].sub(
            _amount,
            'SavingsAccount::transferFrom allowance limit exceeding'
        );

        _amount = IYield(_strategy).getSharesForTokens(_amount, _token);

        //reduce sender's balance
        balanceInShares[_from][_token][_strategy] = balanceInShares[_from][_token][_strategy].sub(
            _amount,
            'SavingsAccount::transferFrom insufficient balance'
        );

        //update receiver's balance
        balanceInShares[_to][_token][_strategy] = (balanceInShares[_to][_token][_strategy]).add(_amount);

        emit Transfer(_token, _strategy, _from, _to, _amount);
    }

    /**
    @notice used to burn token shares
    @dev _amount in function parameter is in terms of _token and _amount returned is in terms of tokenShares from _strategy strategy
    @param _amount The amount of tokens that will be burnt
    @param _token The address of the token whose shares will be burnt
    @param _strategy The address of the strategy from which the _token's shares will be burnt
    @return _amount The amount of _token shares that were burnt
    */
    function burn(
        uint256 _amount, 
        address _token, 
        address _strategy
    ) external override returns(uint256) {
        require(_amount != 0, "SavingsAccount::burn _amount cannot be zero");
        
        _amount = IYield(_strategy).getSharesForTokens(_amount, _token);

        balanceInShares[msg.sender][_token][_strategy] = balanceInShares[msg.sender][_token][_strategy].sub(
            _amount, 
            "SavingsAccount::burn Burn _amount should should be less than or equal to your balance"
        );

        emit Burned(_token, _strategy, msg.sender, _amount);

        return _amount;
    }

    /**
     * @notice used to query total tokens of a token with a user
     * @param _user address of the user
     * @param _token address of token
     * @return _totalTokens total number of tokens of the token with the user
     */
    function getTotalTokens(address _user, address _token) external override returns (uint256 _totalTokens) {
        address[] memory _strategyList = IStrategyRegistry(strategyRegistry).getStrategies();

        for (uint256 i; i < _strategyList.length; ++i) {
            uint256 _liquidityShares = balanceInShares[_user][_token][_strategyList[i]];

            if (_liquidityShares != 0) {
                uint256 _tokenInStrategy = _liquidityShares;
                _tokenInStrategy = IYield(_strategyList[i]).getTokensForShares(_liquidityShares, _token);
                _totalTokens = _totalTokens.add(_tokenInStrategy);
            }
        }
    }
}
