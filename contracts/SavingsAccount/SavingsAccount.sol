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
     * @dev initialize the contract
     * @param _owner address of the owner of the savings account contract
     * @param _strategyRegistry address of the strategy registry
     **/
    function initialize(
        address _owner,
        address _strategyRegistry
    ) external initializer {
        __Ownable_init();
        super.transferOwnership(_owner);

        _updateStrategyRegistry(_strategyRegistry);
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
        address _token,
        address _strategy,
        address _to,
        uint256 _amount
    ) external override nonReentrant returns (uint256) {
        require(_to != address(0), 'SavingsAccount::deposit receiver address should not be zero address');
        require(_amount != 0, 'SavingsAccount::_deposit Amount must be greater than zero');
        require(IStrategyRegistry(strategyRegistry).registry(_strategy), 'SavingsAccount::deposit strategy do not exist');
        uint256 _sharesReceived = IYield(_strategy).lockTokens(msg.sender, _token, _amount);
        balanceInShares[_to][_token][_strategy] = balanceInShares[_to][_token][_strategy].add(_sharesReceived);
        emit Deposited(_to, _sharesReceived, _token, _strategy);
        return _sharesReceived;
    }

    /**
     * @dev Used to switch saving strategy of an _token
     * @param _currentStrategy initial strategy of token
     * @param _newStrategy new strategy to invest
     * @param _token address of the token
     * @param _amount amount of tokens to be reinvested
     */
    function switchStrategy(
        address _currentStrategy,
        address _newStrategy,
        address _token,
        uint256 _amount
    ) external override nonReentrant {
        require(_currentStrategy != _newStrategy, 'SavingsAccount::switchStrategy Same strategy');
        IStrategyRegistry _registry = IStrategyRegistry(strategyRegistry);
        require(_registry.registry(_newStrategy), 'SavingsAccount::_newStrategy do not exist');
        require(_registry.isValidStrategy(_currentStrategy), 'SavingsAccount::_currentStrategy do not exist');
        require(_amount != 0, 'SavingsAccount::switchStrategy Amount must be greater than zero');

        IYield currentStrategy = IYield(_currentStrategy);
        _amount = currentStrategy.getSharesForTokens(_amount, _token);

        balanceInShares[msg.sender][_token][_currentStrategy] = balanceInShares[msg.sender][_token][_currentStrategy].sub(
            _amount,
            'SavingsAccount::switchStrategy Insufficient balance'
        );

        uint256 _tokensReceived = currentStrategy.unlockTokens(_token, _amount);

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
        address _token,
        address _strategy,
        address _to,
        uint256 _amount,
        bool _withdrawShares
    ) external override nonReentrant returns (uint256) {
        require(_amount != 0, 'SavingsAccount::withdraw Amount must be greater than zero');
        require(IStrategyRegistry(strategyRegistry).isValidStrategy(_strategy), 'SavingsAccount::_currentStrategy do not exist');

        _amount = IYield(_strategy).getSharesForTokens(_amount, _token);

        balanceInShares[msg.sender][_token][_strategy] = balanceInShares[msg.sender][_token][_strategy].sub(
            _amount,
            'SavingsAccount::withdraw Insufficient amount'
        );

        (, uint256 _amountReceived) = _withdraw(_token, _strategy, _to, _amount, _withdrawShares);

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
        address _token,
        address _strategy,
        address _from,
        address _to,
        uint256 _amount,
        bool _withdrawShares
    ) external override nonReentrant returns (uint256) {
        require(_amount != 0, 'SavingsAccount::withdrawFrom Amount must be greater than zero');
        require(IStrategyRegistry(strategyRegistry).isValidStrategy(_strategy), 'SavingsAccount::_currentStrategy do not exist');
        uint256 _currentAllowance = allowance[_from][_token][msg.sender];
        if(_currentAllowance != type(uint256).max) {
            allowance[_from][_token][msg.sender] = _currentAllowance.sub(
                _amount,
                'SavingsAccount::withdrawFrom allowance limit exceeding'
            );
        }

        _amount = IYield(_strategy).getSharesForTokens(_amount, _token);

        balanceInShares[_from][_token][_strategy] = balanceInShares[_from][_token][_strategy].sub(
            _amount,
            'SavingsAccount::withdrawFrom insufficient balance'
        );
        (, uint256 _amountReceived) = _withdraw(_token, _strategy, _to, _amount, _withdrawShares);
        emit Withdrawn(_from, msg.sender, _amount, _token, _strategy, _withdrawShares);
        return _amountReceived;
    }

    function _withdraw(
        address _token,
        address _strategy,
        address _to,
        uint256 _amount,
        bool _withdrawShares
    ) internal returns (address, uint256) {
        address _tokenReceived;
        uint256 _amountReceived;
        if (_withdrawShares) {
            IYield strategy = IYield(_strategy);
            _tokenReceived = strategy.liquidityToken(_token);
            require(_tokenReceived != address(0), 'Liquidity Tokens address cannot be address(0)');
            _amountReceived = strategy.unlockShares(_tokenReceived, _amount);
        } else {
            _tokenReceived = _token;
            _amountReceived = IYield(_strategy).unlockTokens(_token, _amount);
        }
        _transfer(_tokenReceived, _to, _amountReceived);
        return (_tokenReceived, _amountReceived);
    }

    function _transfer(
        address _token,
        address _to,
        uint256 _amount
    ) internal {
        IERC20(_token).safeTransfer(_to, _amount);
    }

    /**
     * @notice used to withdraw a token from all strategies
     * @param _token address of token which is to be withdrawn
     */
    function withdrawAll(address _token) external override nonReentrant returns (uint256) {
        address[] memory _strategyList = IStrategyRegistry(strategyRegistry).getStrategies();
        uint256 _tokenReceived;

        for (uint256 i; i < _strategyList.length; ++i) {
            if (balanceInShares[msg.sender][_token][_strategyList[i]] != 0 && _strategyList[i] != address(0)) {
                uint256 _amount = IYield(_strategyList[i]).unlockTokens(_token, balanceInShares[msg.sender][_token][_strategyList[i]]);
                _tokenReceived = _tokenReceived.add(_amount);
                delete balanceInShares[msg.sender][_token][_strategyList[i]];
            }
        }

        if (_tokenReceived == 0) return 0;

        _transfer(_token, (msg.sender), _tokenReceived);

        emit WithdrawnAll(msg.sender, _tokenReceived, _token);

        return _tokenReceived;
    }

    function withdrawAll(address _token, address _strategy) external override nonReentrant returns (uint256) {
        require(IStrategyRegistry(strategyRegistry).isValidStrategy(_strategy), 'SavingsAccount::_currentStrategy do not exist');
        uint256 _sharesBalance = balanceInShares[msg.sender][_token][_strategy];

        if (_sharesBalance == 0) return 0;

        uint256 _amount = IYield(_strategy).unlockTokens(_token, _sharesBalance);

        delete balanceInShares[msg.sender][_token][_strategy];

        _transfer(_token, (msg.sender), _amount);

        emit Withdrawn(msg.sender, msg.sender, _amount, _token, _strategy, false);

        return _amount;
    }

    /**
     * @notice used to approve allowance to an address
     * @dev this is prone to race condition, hence increaseAllowance is recommended
     * @param _amount amount of tokens approved
     * @param _token address of token approved
     * @param _to address of the user approved to
     */
    function approve(
        address _token,
        address _to,
        uint256 _amount
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
        address _token,
        address _to,
        uint256 _amount
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
        address _token,
        address _to,
        uint256 _amount
    ) external override {
        uint256 _updatedAllowance = allowance[msg.sender][_token][_to].sub(_amount);
        allowance[msg.sender][_token][_to] = _updatedAllowance;

        emit Approved(_token, msg.sender, _to, _updatedAllowance);
    }

    /**
     * @notice used to transfer tokens
     * @param _shares shares of tokens transferred
     * @param _token address of token transferred
     * @param _strategy address of the strategy from which tokens are transferred
     * @param _to address of the user tokens are transferred to
     */
    function transferShares(
        uint256 _shares,
        address _token,
        address _strategy,
        address _to
    ) external override returns (uint256) {
        require(_shares != 0, 'SavingsAccount::transfer zero amount');

        balanceInShares[msg.sender][_token][_strategy] = balanceInShares[msg.sender][_token][_strategy].sub(
            _shares,
            'SavingsAccount::transfer insufficient funds'
        );
        balanceInShares[_to][_token][_strategy] = balanceInShares[_to][_token][_strategy].add(_shares);

        emit TransferShares(_token, _strategy, msg.sender, _to, _shares);

        return _shares;
    }

    /**
     * @notice used to transfer tokens
     * @param _amount amount of tokens transferred
     * @param _token address of token transferred
     * @param _strategy address of the strategy from which tokens are transferred
     * @param _to address of the user tokens are transferred to
     */
    function transfer(
        address _token,
        address _strategy,
        address _to,
        uint256 _amount
    ) external override returns (uint256) {
        require(_amount != 0, 'SavingsAccount::transfer zero amount');
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
     * @param _shares shares of tokens transferred
     * @param _token address of token transferred
     * @param _strategy address of the strategy from which tokens are transferred
     * @param _from address from whose allowance tokens are transferred
     * @param _to address of the user tokens are transferred to
     */
    function transferSharesFrom(
        uint256 _shares,
        address _token,
        address _strategy,
        address _from,
        address _to
    ) external override returns (uint256) {
        require(_shares != 0, 'SavingsAccount::transfer zero amount');
        uint256 _amount = IYield(_strategy).getTokensForShares(_shares, _token);

        uint256 _currentAllowance = allowance[_from][_token][msg.sender];
        if(_currentAllowance != type(uint256).max) {
            allowance[_from][_token][msg.sender] = _currentAllowance.sub(
                _amount,
                'SavingsAccount::transferFrom allowance limit exceeding'
            );
        }

        balanceInShares[_from][_token][_strategy] = balanceInShares[_from][_token][_strategy].sub(
            _shares,
            'SavingsAccount::transferFrom insufficient allowance'
        );

        balanceInShares[_to][_token][_strategy] = (balanceInShares[_to][_token][_strategy]).add(_shares);

        emit Transfer(_token, _strategy, _from, _to, _shares);

        return _shares;
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
        address _token,
        address _strategy,
        address _from,
        address _to,
        uint256 _amount
    ) external override returns (uint256) {
        require(_amount != 0, 'SavingsAccount::transferFrom zero amount');
        //update allowance
        uint256 _currentAllowance = allowance[_from][_token][msg.sender];
        if(_currentAllowance != type(uint256).max) {
            allowance[_from][_token][msg.sender] = _currentAllowance.sub(
                _amount,
                'SavingsAccount::transferFrom allowance limit exceeding'
            );
        }

        _amount = IYield(_strategy).getSharesForTokens(_amount, _token);

        //reduce sender's balance
        balanceInShares[_from][_token][_strategy] = balanceInShares[_from][_token][_strategy].sub(
            _amount,
            'SavingsAccount::transferFrom insufficient balance'
        );

        //update receiver's balance
        balanceInShares[_to][_token][_strategy] = (balanceInShares[_to][_token][_strategy]).add(_amount);

        emit Transfer(_token, _strategy, _from, _to, _amount);

        return _amount;
    }

    /**
     * @notice used to query total tokens of a token with a user
     * @param _user address of the user
     * @param _token address of token
     * @return _totalTokens total number of tokens of the token with the user
     */
    function getTotalTokens(address _user, address _token) external override returns (uint256) {
        address[] memory _strategyList = IStrategyRegistry(strategyRegistry).getStrategies();
        uint256 _totalTokens;

        for (uint256 i; i < _strategyList.length; ++i) {
            uint256 _liquidityShares = balanceInShares[_user][_token][_strategyList[i]];

            if (_liquidityShares != 0) {
                uint256 _tokenInStrategy = _liquidityShares;
                _tokenInStrategy = IYield(_strategyList[i]).getTokensForShares(_liquidityShares, _token);
                _totalTokens = _totalTokens.add(_tokenInStrategy);
            }
        }
        return _totalTokens;
    }
}
