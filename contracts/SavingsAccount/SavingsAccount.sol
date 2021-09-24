// SPDX-License-Identifier: MIT
pragma solidity 0.7.0;

import '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';
import '@openzeppelin/contracts/utils/ReentrancyGuard.sol';
import '@openzeppelin/contracts/token/ERC20/SafeERC20.sol';
import '@openzeppelin/contracts/math/SafeMath.sol';

import '../interfaces/ISavingsAccount.sol';
import '../interfaces/IStrategyRegistry.sol';
import '../interfaces/IYield.sol';

import "hardhat/console.sol";

/**
 * @title Savings account contract with Methods related to savings account
 * @notice Implements the functions related to savings account
 * @author Sublime
 **/
contract SavingsAccount is ISavingsAccount, Initializable, OwnableUpgradeable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using SafeMath for uint256;

    address public strategyRegistry;
    address public creditLine;

    //user -> token -> strategy (underlying address) -> amount (shares)
    mapping(address => mapping(address => mapping(address => uint256))) public override balanceInShares;

    //user => token => to => amount
    mapping(address => mapping(address => mapping(address => uint256))) public allowance;

    modifier onlyCreditLine(address _caller) {
        require(_caller == creditLine, 'Invalid caller');
        _;
    }

    // TODO : Track strategies per user and limit no of strategies to 5

    /**
     * @dev initialize the contract
     * @param _owner address of the owner of the savings account contract
     * @param _strategyRegistry address of the strategy registry
     **/
    function initialize(
        address _owner,
        address _strategyRegistry,
        address _creditLine
    ) public initializer {
        __Ownable_init();
        super.transferOwnership(_owner);

        _updateCreditLine(_creditLine);
        _updateStrategyRegistry(_strategyRegistry);
    }

    function updateCreditLine(address _creditLine) public onlyOwner {
        _updateCreditLine(_creditLine);
    }

    function _updateCreditLine(address _creditLine) internal {
        require(_creditLine != address(0), 'SavingsAccount::initialize zero address');
        creditLine = _creditLine;
        emit CreditLineUpdated(_creditLine);
    }

    function updateStrategyRegistry(address _strategyRegistry) public onlyOwner {
        _updateStrategyRegistry(_strategyRegistry);
    }

    function _updateStrategyRegistry(address _strategyRegistry) internal {
        require(_strategyRegistry != address(0), 'SavingsAccount::updateStrategyRegistry zero address');
        strategyRegistry = _strategyRegistry;
        emit StrategyRegistryUpdated(_strategyRegistry);
    }

    function deposit(
        uint256 _amount,
        address _token,
        address _strategy,
        address _to
    ) external payable override nonReentrant returns (uint256) {
        require(_to != address(0), 'SavingsAccount::deposit receiver address should not be zero address');

        uint256 _sharesReceived = _deposit(_amount, _token, _strategy);

        balanceInShares[_to][_token][_strategy] = balanceInShares[_to][_token][_strategy].add(_sharesReceived);

        emit Deposited(_to, _amount, _token, _strategy);

        return _sharesReceived;
    }

    function _deposit(
        uint256 _amount,
        address _token,
        address _strategy
    ) internal returns (uint256 _sharesReceived) {
        require(_amount != 0, 'SavingsAccount::_deposit Amount must be greater than zero');

        if (_strategy != address(0)) {
            _sharesReceived = _depositToYield(_amount, _token, _strategy);
        } else {
            _sharesReceived = _amount;
            if (_token != address(0)) {
                IERC20(_token).safeTransferFrom(msg.sender, address(this), _amount);
            } else {
                require(msg.value == _amount, 'SavingsAccount::deposit ETH sent must be equal to amount');
            }
        }
    }

    function _depositToYield(
        uint256 _amount,
        address _token,
        address _strategy
    ) internal returns (uint256 _sharesReceived) {
        require(IStrategyRegistry(strategyRegistry).registry(_strategy), 'SavingsAccount::deposit strategy do not exist');
        uint256 _ethValue;

        if (_token == address(0)) {
            _ethValue = _amount;
        }

        _sharesReceived = IYield(_strategy).lockTokens{value: _ethValue}(msg.sender, _token, _amount);
    }

    /**
     * @dev Used to switch saving strategy of an _token
     * @param _currentStrategy initial strategy of token
     * @param _newStrategy new strategy to invest
     * @param _token address of the token
     * @param _amount amount of **liquidity shares** to be reinvested
     */
    function switchStrategy(
        uint256 _amount,
        address _token,
        address _currentStrategy,
        address _newStrategy
    ) external override nonReentrant {
        require(_currentStrategy != _newStrategy, 'SavingsAccount::switchStrategy Same strategy');
        require(_amount != 0, 'SavingsAccount::switchStrategy Amount must be greater than zero');

        if (_currentStrategy != address(0)) {
            _amount = IYield(_currentStrategy).getSharesForTokens(_amount, _token);
        }

        balanceInShares[msg.sender][_token][_currentStrategy] = balanceInShares[msg.sender][_token][_currentStrategy].sub(
            _amount,
            'SavingsAccount::switchStrategy Insufficient balance'
        );

        uint256 _tokensReceived = _amount;
        if (_currentStrategy != address(0)) {
            _tokensReceived = IYield(_currentStrategy).unlockTokens(_token, _amount);
        }

        uint256 _sharesReceived = _tokensReceived;
        if (_newStrategy != address(0)) {
            if (_token != address(0)) {
                IERC20(_token).safeApprove(_newStrategy, _tokensReceived);
            }

            _sharesReceived = _depositToYield(_tokensReceived, _token, _newStrategy);
        }

        balanceInShares[msg.sender][_token][_newStrategy] = balanceInShares[msg.sender][_token][_newStrategy].add(_sharesReceived);

        emit StrategySwitched(msg.sender, _token, _currentStrategy, _newStrategy);
    }

    /**
     * @dev Used to withdraw token from Saving Account
     * @param _to address to which token should be sent
     * @param _amount amount of liquidity shares to withdraw
     * @param _token address of the token to be withdrawn
     * @param _strategy strategy from where token has to withdrawn(ex:- compound,Aave etc)
     * @param _withdrawShares boolean indicating to withdraw in liquidity share or underlying token
     */
    function withdraw(
        uint256 _amount,
        address _token,
        address _strategy,
        address payable _to,
        bool _withdrawShares
    ) external override nonReentrant returns (uint256) {
        require(_amount != 0, 'SavingsAccount::withdraw Amount must be greater than zero');

        if (_strategy != address(0)) {
            _amount = IYield(_strategy).getSharesForTokens(_amount, _token);
        }

        balanceInShares[msg.sender][_token][_strategy] = balanceInShares[msg.sender][_token][_strategy].sub(
            _amount,
            'SavingsAccount::withdraw Insufficient amount'
        );

        (address _token, uint256 _amountReceived) = _withdraw(_amount, _token, _strategy, _to, _withdrawShares);

        emit Withdrawn(msg.sender, _to, _amountReceived, _token, _strategy);
        return _amountReceived;
    }

    function withdrawFrom(
        uint256 _amount,
        address _token,
        address _strategy,
        address _from,
        address payable _to,
        bool _withdrawShares
    ) external override nonReentrant returns (uint256) {
        require(_amount != 0, 'SavingsAccount::withdrawFrom Amount must be greater than zero');

        allowance[_from][_token][msg.sender] = allowance[_from][_token][msg.sender].sub(
            _amount,
            'SavingsAccount::withdrawFrom allowance limit exceeding'
        );
        if (_strategy != address(0)) {
            _amount = IYield(_strategy).getSharesForTokens(_amount, _token);
        }

        balanceInShares[_from][_token][_strategy] = balanceInShares[_from][_token][_strategy].sub(
            _amount,
            'SavingsAccount::withdrawFrom insufficient balance'
        );
        (address _token, uint256 _amountReceived) = _withdraw(_amount, _token, _strategy, _to, _withdrawShares);
        emit Withdrawn(_from, msg.sender, _amountReceived, _token, _strategy);
        return _amountReceived;
    }

    function _withdraw(
        uint256 _amount,
        address _token,
        address _strategy,
        address payable _to,
        bool _withdrawShares
    ) internal returns (address _tokenReceived, uint256 _amountReceived) {
        if (_strategy == address(0)) {
            _transfer(_amount, _token, _to);
            return (_token, _amount);
        }

        if (_withdrawShares) {
            _tokenReceived = IYield(_strategy).liquidityToken(_token);
            require(_tokenReceived != address(0), 'Liquidity Tokens address cannot be address(0)');
            _amountReceived = IYield(_strategy).unlockShares(_tokenReceived, _amount);
        } else {
            _tokenReceived = _token;
            _amountReceived = IYield(_strategy).unlockTokens(_token, _amount);
        }
        _transfer(_amountReceived, _tokenReceived, _to);
    }

    function _transfer(
        uint256 _amount,
        address _token,
        address payable _to
    ) internal {
        if (_token == address(0)) {
            (bool _success, ) = _to.call{value: _amount}('');
            require(_success, 'Transfer failed');
        } else {
            IERC20(_token).safeTransfer(_to, _amount);
        }
    }

    function withdrawAll(address _token) external override nonReentrant returns (uint256 _tokenReceived) {
        address[] memory _strategyList = IStrategyRegistry(strategyRegistry).getStrategies();

        for (uint256 i = 0; i < _strategyList.length; i++) {
            if (balanceInShares[msg.sender][_token][_strategyList[i]] != 0) {
                uint256 _amount = balanceInShares[msg.sender][_token][_strategyList[i]];
                if (_strategyList[i] != address(0)) {
                    _amount = IYield(_strategyList[i]).unlockTokens(_token, balanceInShares[msg.sender][_token][_strategyList[i]]);
                }
                _tokenReceived = _tokenReceived.add(_amount);
                delete balanceInShares[msg.sender][_token][_strategyList[i]];
            }
        }

        if (_tokenReceived == 0) return 0;

        _transfer(_tokenReceived, _token, payable(msg.sender));

        emit WithdrawnAll(msg.sender, _tokenReceived, _token);
    }

    function approve(
        uint256 _amount,
        address _token,
        address _to
    ) external override {
        allowance[msg.sender][_token][_to] = _amount;

        emit Approved(_token, msg.sender, _to, _amount);
    }

    function increaseAllowance(
        uint256 _amount,
        address _token,
        address _to
    ) external override {
        uint256 _updatedAllowance = allowance[msg.sender][_token][_to].add(_amount);
        allowance[msg.sender][_token][_to] = _updatedAllowance;

        emit Approved(_token, msg.sender, _to, _updatedAllowance);
    }

    function decreaseAllowance(
        uint256 _amount,
        address _token,
        address _to
    ) external override {
        uint256 _updatedAllowance = allowance[msg.sender][_token][_to].sub(_amount);
        allowance[msg.sender][_token][_to] = _updatedAllowance;

        emit Approved(_token, msg.sender, _to, _updatedAllowance);
    }

    function increaseAllowanceToCreditLine(
        uint256 _amount,
        address _token,
        address _from
    ) external override onlyCreditLine(msg.sender) {
        allowance[_from][_token][msg.sender] = allowance[_from][_token][msg.sender].add(_amount);

        emit CreditLineAllowanceRefreshed(_token, _from, _amount);
    }

    function transfer(
        uint256 _amount,
        address _token,
        address _strategy,
        address _to
    ) external override returns (uint256) {
        require(_amount != 0, 'SavingsAccount::transfer zero amount');

        if (_strategy != address(0)) {
            _amount = IYield(_strategy).getSharesForTokens(_amount, _token);
        }

        balanceInShares[msg.sender][_token][_strategy] = balanceInShares[msg.sender][_token][_strategy].sub(
            _amount,
            'SavingsAccount::transfer insufficient funds'
        );

        //update receiver's balance
        balanceInShares[_to][_token][_strategy] = balanceInShares[_to][_token][_strategy].add(_amount);

        emit Transfer(_token, _strategy, msg.sender, _to, _amount);

        return _amount;
    }

    function transferFrom(
        uint256 _amount,
        address _token,
        address _strategy,
        address _from,
        address _to
    ) external override returns (uint256) {
        require(_amount != 0, 'SavingsAccount::transferFrom zero amount');
        //update allowance
        allowance[_from][_token][msg.sender] = allowance[_from][_token][msg.sender].sub(
            _amount,
            'SavingsAccount::transferFrom allowance limit exceeding'
        );

        if (_strategy != address(0)) {
            _amount = IYield(_strategy).getSharesForTokens(_amount, _token);
        }

        //reduce sender's balance
        balanceInShares[_from][_token][_strategy] = balanceInShares[_from][_token][_strategy].sub(
            _amount,
            'SavingsAccount::transferFrom insufficient allowance'
        );

        //update receiver's balance
        balanceInShares[_to][_token][_strategy] = (balanceInShares[_to][_token][_strategy]).add(_amount);

        emit Transfer(_token, _strategy, _from, _to, _amount);

        return _amount;
    }

    function getTotalTokens(address _user, address _token) public override returns (uint256 _totalTokens) {
        address[] memory _strategyList = IStrategyRegistry(strategyRegistry).getStrategies();

        for (uint256 i = 0; i < _strategyList.length; i++) {
            uint256 _liquidityShares = balanceInShares[_user][_token][_strategyList[i]];

            if (_liquidityShares != 0) {
                uint256 _tokenInStrategy = _liquidityShares;
                if (_strategyList[i] != address(0)) {
                    _tokenInStrategy = IYield(_strategyList[i]).getTokensForShares(_liquidityShares, _token);
                }

                _totalTokens = _totalTokens.add(_tokenInStrategy);
            }
        }
    }

    receive() external payable {}
}
