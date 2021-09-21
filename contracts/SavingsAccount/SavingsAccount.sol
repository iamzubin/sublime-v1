// SPDX-License-Identifier: MIT
pragma solidity 0.7.0;

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

    address public strategyRegistry;
    address public creditLine;

    //user -> token -> strategy (underlying address) -> amount (shares)
    mapping(address => mapping(address => mapping(address => uint256))) public override userLockedBalance;

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
        uint256 amount,
        address token,
        address strategy,
        address to
    ) external payable override nonReentrant returns (uint256 sharesReceived) {
        require(to != address(0), 'SavingsAccount::deposit receiver address should not be zero address');

        sharesReceived = _deposit(amount, token, strategy);

        userLockedBalance[to][token][strategy] = userLockedBalance[to][token][strategy].add(sharesReceived);

        emit Deposited(to, amount, token, strategy);
    }

    function _deposit(
        uint256 amount,
        address _token,
        address strategy
    ) internal returns (uint256 sharesReceived) {
        require(amount != 0, 'SavingsAccount::_deposit Amount must be greater than zero');

        if (strategy != address(0)) {
            sharesReceived = _depositToYield(amount, _token, strategy);
        } else {
            sharesReceived = amount;
            if (_token != address(0)) {
                IERC20(_token).safeTransferFrom(msg.sender, address(this), amount);
            } else {
                require(msg.value == amount, 'SavingsAccount::deposit ETH sent must be equal to amount');
            }
        }
    }

    function _depositToYield(
        uint256 amount,
        address _token,
        address strategy
    ) internal returns (uint256 sharesReceived) {
        require(IStrategyRegistry(strategyRegistry).registry(strategy), 'SavingsAccount::deposit strategy do not exist');

        if (_token == address(0)) {
            sharesReceived = IYield(strategy).lockTokens{value: amount}(msg.sender, _token, amount);
        } else {
            sharesReceived = IYield(strategy).lockTokens(msg.sender, _token, amount);
        }
    }

    /**
     * @dev Used to switch saving strategy of an _token
     * @param currentStrategy initial strategy of token
     * @param newStrategy new strategy to invest
     * @param token address of the token
     * @param amount amount of **liquidity shares** to be reinvested
     */
    function switchStrategy(
        uint256 amount,
        address token,
        address currentStrategy,
        address newStrategy
    ) external override nonReentrant {
        require(currentStrategy != newStrategy, 'SavingsAccount::switchStrategy Same strategy');
        require(amount != 0, 'SavingsAccount::switchStrategy Amount must be greater than zero');

        if (currentStrategy != address(0)) {
            amount = IYield(currentStrategy).getSharesForTokens(amount, token);
        }

        userLockedBalance[msg.sender][token][currentStrategy] = userLockedBalance[msg.sender][token][currentStrategy].sub(
            amount,
            'SavingsAccount::switchStrategy Insufficient balance'
        );

        uint256 tokensReceived = amount;
        if (currentStrategy != address(0)) {
            tokensReceived = IYield(currentStrategy).unlockTokens(token, amount);
        }

        uint256 sharesReceived = tokensReceived;
        if (newStrategy != address(0)) {
            if (token != address(0)) {
                IERC20(token).safeApprove(newStrategy, tokensReceived);
            }

            sharesReceived = _depositToYield(tokensReceived, token, newStrategy);
        }

        userLockedBalance[msg.sender][token][newStrategy] = userLockedBalance[msg.sender][token][newStrategy].add(sharesReceived);

        emit StrategySwitched(msg.sender, token, currentStrategy, newStrategy);
    }

    /**
     * @dev Used to withdraw token from Saving Account
     * @param withdrawTo address to which token should be sent
     * @param amount amount of liquidity shares to withdraw
     * @param token address of the token to be withdrawn
     * @param strategy strategy from where token has to withdrawn(ex:- compound,Aave etc)
     * @param withdrawShares boolean indicating to withdraw in liquidity share or underlying token
     */
    function withdraw(
        uint256 amount,
        address token,
        address strategy,
        address payable withdrawTo,
        bool withdrawShares
    ) external override nonReentrant returns (uint256 amountReceived) {
        require(amount != 0, 'SavingsAccount::withdraw Amount must be greater than zero');

        if (strategy != address(0)) {
            amount = IYield(strategy).getSharesForTokens(amount, token);
        }

        userLockedBalance[msg.sender][token][strategy] = userLockedBalance[msg.sender][token][strategy].sub(
            amount,
            'SavingsAccount::withdraw Insufficient amount'
        );

        address token;
        (token, amountReceived) = _withdraw(amount, token, strategy, withdrawTo, withdrawShares);

        emit Withdrawn(msg.sender, withdrawTo, amountReceived, token, strategy);
    }

    function withdrawFrom(
        uint256 amount,
        address token,
        address strategy,
        address from,
        address payable to,
        bool withdrawShares
    ) external override nonReentrant returns (uint256 amountReceived) {
        require(amount != 0, 'SavingsAccount::withdrawFrom Amount must be greater than zero');

        allowance[from][token][msg.sender] = allowance[from][token][msg.sender].sub(
            amount,
            'SavingsAccount::withdrawFrom allowance limit exceeding'
        );
        if (strategy != address(0)) {
            amount = IYield(strategy).getSharesForTokens(amount, token);
        }

        //reduce sender's balance
        userLockedBalance[from][token][strategy] = userLockedBalance[from][token][strategy].sub(
            amount,
            'SavingsAccount::withdrawFrom insufficient balance'
        );
        address token;
        (token, amountReceived) = _withdraw(amount, token, strategy, to, withdrawShares);
        emit Withdrawn(from, msg.sender, amountReceived, token, strategy);
    }

    function _withdraw(
        uint256 amount,
        address _token,
        address strategy,
        address payable withdrawTo,
        bool withdrawShares
    ) internal returns (address token, uint256 amountReceived) {
        if (strategy == address(0)) {
            _transfer(amountReceived, _token, withdrawTo);
            return (_token, amount);
        }

        if (withdrawShares) {
            token = IYield(strategy).liquidityToken(_token);
            require(token != address(0), 'Liquidity Tokens address cannot be address(0)');
            amountReceived = IYield(strategy).unlockShares(token, amount);
            _transfer(amountReceived, token, withdrawTo);
        } else {
            token = _token;
            amountReceived = IYield(strategy).unlockTokens(_token, amount);
            _transfer(amountReceived, token, withdrawTo);
        }
    }

    function _transfer(
        uint256 amount,
        address token,
        address payable withdrawTo
    ) internal {
        if (token == address(0)) {
            (bool success, ) = withdrawTo.call{value: amount}('');
            require(success, 'Transfer failed');
        } else {
            IERC20(token).safeTransfer(withdrawTo, amount);
        }
    }

    function withdrawAll(address _token) external override nonReentrant returns (uint256 tokenReceived) {
        // Withdraw tokens
        address[] memory _strategyList = IStrategyRegistry(strategyRegistry).getStrategies();

        for (uint256 index = 0; index < _strategyList.length; index++) {
            if (userLockedBalance[msg.sender][_token][_strategyList[index]] != 0) {
                uint256 _amount = userLockedBalance[msg.sender][_token][_strategyList[index]];
                if (_strategyList[index] != address(0)) {
                    _amount = IYield(_strategyList[index]).unlockTokens(
                        _token,
                        userLockedBalance[msg.sender][_token][_strategyList[index]]
                    );
                }
                tokenReceived = tokenReceived.add(_amount);
                delete userLockedBalance[msg.sender][_token][_strategyList[index]];
            }
        }

        if (tokenReceived == 0) return 0;

        _transfer(tokenReceived, _token, payable(msg.sender));

        emit WithdrawnAll(msg.sender, tokenReceived, _token);
    }

    function approve(
        uint256 amount,
        address token,
        address to
    ) external override {
        allowance[msg.sender][token][to] = amount;

        emit Approved(token, msg.sender, to, amount);
    }

    function increaseAllowance(
        uint256 amount,
        address token,
        address to
    ) external override {
        uint256 _updatedAllowance = allowance[msg.sender][token][to].add(amount);
        allowance[msg.sender][token][to] = _updatedAllowance;

        emit Approved(token, msg.sender, to, _updatedAllowance);
    }

    function decreaseAllowance(
        uint256 amount,
        address token,
        address to
    ) external override {
        uint256 _updatedAllowance = allowance[msg.sender][token][to].sub(amount);
        allowance[msg.sender][token][to] = _updatedAllowance;

        emit Approved(token, msg.sender, to, _updatedAllowance);
    }

    function increaseAllowanceToCreditLine(
        uint256 amount,
        address token,
        address from
    ) external override onlyCreditLine(msg.sender) {
        allowance[from][token][msg.sender] = allowance[from][token][msg.sender].add(amount);

        emit CreditLineAllowanceRefreshed(token, from, amount);
    }

    function transfer(
        uint256 amount,
        address token,
        address strategy,
        address to
    ) external override returns (uint256) {
        require(amount != 0, 'SavingsAccount::transfer zero amount');

        if (strategy != address(0)) {
            amount = IYield(strategy).getSharesForTokens(amount, token);
        }

        //reduce msg.sender balance
        userLockedBalance[msg.sender][token][strategy] = userLockedBalance[msg.sender][token][strategy].sub(
            amount,
            'SavingsAccount::transfer insufficient funds'
        );

        //update receiver's balance
        userLockedBalance[to][token][strategy] = userLockedBalance[to][token][strategy].add(amount);

        emit Transfer(token, strategy, msg.sender, to, amount);
        //not sure
        return amount;
    }

    function transferFrom(
        uint256 amount,
        address token,
        address strategy,
        address from,
        address to
    ) external override returns (uint256) {
        require(amount != 0, 'SavingsAccount::transferFrom zero amount');
        //update allowance
        allowance[from][token][msg.sender] = allowance[from][token][msg.sender].sub(
            amount,
            'SavingsAccount::transferFrom allowance limit exceeding'
        );

        if (strategy != address(0)) {
            amount = IYield(strategy).getSharesForTokens(amount, token);
        }

        //reduce sender's balance
        userLockedBalance[from][token][strategy] = userLockedBalance[from][token][strategy].sub(
            amount,
            'SavingsAccount::transferFrom insufficient allowance'
        );

        //update receiver's balance
        userLockedBalance[to][token][strategy] = (userLockedBalance[to][token][strategy]).add(amount);

        emit Transfer(token, strategy, from, to, amount);

        //not sure
        return amount;
    }

    function getTotalTokens(address _user, address _token) public override returns (uint256 _totalTokens) {
        address[] memory _strategyList = IStrategyRegistry(strategyRegistry).getStrategies();

        for (uint256 _index = 0; _index < _strategyList.length; _index++) {
            uint256 _liquidityShares = userLockedBalance[_user][_token][_strategyList[_index]];

            if (_liquidityShares != 0) {
                uint256 _tokenInStrategy = _liquidityShares;
                if (_strategyList[_index] != address(0)) {
                    _tokenInStrategy = IYield(_strategyList[_index]).getTokensForShares(_liquidityShares, _token);
                }

                _totalTokens = _totalTokens.add(_tokenInStrategy);
            }
        }
    }

    receive() external payable {
        // require(
        //     IStrategyRegistry(strategyRegistry).registry(msg.sender),
        //     "SavingsAccount::receive invalid transaction"
        // );
        // the above snippet of code causes gas issues. Commented till solution is found
    }
}
