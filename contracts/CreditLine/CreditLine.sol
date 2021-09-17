// SPDX-License-Identifier: MIT
pragma solidity 0.7.0;

import '@openzeppelin/contracts/token/ERC20/SafeERC20.sol';
import '@openzeppelin/contracts/math/SafeMath.sol';
import '@openzeppelin/contracts/utils/ReentrancyGuard.sol';
import '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';
import '../interfaces/IPriceOracle.sol';
import '../interfaces/IYield.sol';
import '../interfaces/ISavingsAccount.sol';
import '../SavingsAccount/SavingsAccountUtil.sol';
import '../interfaces/IStrategyRegistry.sol';

/**
 * @title Credit Line contract with Methods related to credit Line
 * @notice Implements the functions related to Credit Line
 * @author Sublime
 **/

contract CreditLine is ReentrancyGuard, OwnableUpgradeable {
    using SafeERC20 for IERC20;
    using SafeMath for uint256;

    enum creditLineStatus {
        NOT_CREATED,
        REQUESTED,
        ACTIVE,
        CLOSED,
        CANCELLED,
        LIQUIDATED
    }

    uint256 public CreditLineCounter;

    uint256 public constant yearInSeconds = 365 days;

    struct CreditLineUsageVars {
        uint256 principal;
        uint256 totalInterestRepaid;
        uint256 lastPrincipalUpdateTime;
        uint256 interestAccruedTillPrincipalUpdate;
        uint256 collateralAmount;
    }

    struct CreditLineVars {
        bool exists;
        address lender;
        address borrower;
        uint256 borrowLimit;
        uint256 idealCollateralRatio;
        uint256 liquidationThreshold;
        uint256 borrowRate;
        address borrowAsset;
        address collateralAsset;
        creditLineStatus currentStatus;
        bool autoLiquidation;
        bool requestByLender;
    }
    mapping(uint256 => mapping(address => uint256)) collateralShareInStrategy;
    mapping(uint256 => CreditLineUsageVars) public creditLineUsage;
    mapping(uint256 => CreditLineVars) public creditLineInfo;

    address public savingsAccount;
    address public priceOracle;
    address public strategyRegistry;
    address public defaultStrategy;
    uint256 public protocolFeeFraction;
    address public protocolFeeCollector;
    /**
     * @dev checks if Credit Line exists
     * @param _id credit hash
     **/
    modifier ifCreditLineExists(uint256 _id) {
        require(creditLineInfo[_id].currentStatus != creditLineStatus.NOT_CREATED, 'Credit line does not exist');
        _;
    }

    /**
     * @dev checks if called by credit Line Borrower
     * @param _id creditLine Hash
     **/
    modifier onlyCreditLineBorrower(uint256 _id) {
        require(creditLineInfo[_id].borrower == msg.sender, 'Only credit line Borrower can access');
        _;
    }

    /**
     * @dev checks if called by credit Line Lender
     * @param _id creditLine Hash
     **/
    modifier onlyCreditLineLender(uint256 _id) {
        require(creditLineInfo[_id].lender == msg.sender, 'Only credit line Lender can access');
        _;
    }

    event CreditLineRequested(uint256 id, address lender, address borrower);

    event CreditLineLiquidated(uint256 id, address liquidator);

    event BorrowedFromCreditLine(uint256 borrowAmount, uint256 id);
    event CreditLineAccepted(uint256 id);
    event CreditLineReset(uint256 id);
    event PartialCreditLineRepaid(uint256 id, uint256 repayAmount);
    event CompleteCreditLineRepaid(uint256 id, uint256 repayAmount);
    event CreditLineClosed(uint256 id);

    event DefaultStrategyUpdated(address defaultStrategy);
    event PriceOracleUpdated(address priceOracle);
    event SavingsAccountUpdated(address savingsAccount);
    event StrategyRegistryUpdated(address strategyRegistry);

    /*
     * @notice emitted when fee that protocol changes for pools is updated
     * @param updatedProtocolFee updated value of protocolFeeFraction
     */
    event ProtocolFeeFractionUpdated(uint256 updatedProtocolFee);

    /*
     * @notice emitted when address which receives fee that protocol changes for pools is updated
     * @param updatedProtocolFeeCollector updated value of protocolFeeCollector
     */
    event ProtocolFeeCollectorUpdated(address updatedProtocolFeeCollector);

    function initialize(
        address _defaultStrategy,
        address _priceOracle,
        address _savingsAccount,
        address _strategyRegistry,
        address _owner,
        uint256 _protocolFeeFraction,
        address _protocolFeeCollector
    ) public initializer {
        OwnableUpgradeable.__Ownable_init();
        OwnableUpgradeable.transferOwnership(_owner);

        _updateDefaultStrategy(_defaultStrategy);
        _updatePriceOracle(_priceOracle);
        _updateSavingsAccount(_savingsAccount);
        _updateStrategyRegistry(_strategyRegistry);
        _updateProtocolFeeFraction(_protocolFeeFraction);
        _updateProtocolFeeCollector(_protocolFeeCollector);
    }

    function updateDefaultStrategy(address _defaultStrategy) external onlyOwner {
        _updateDefaultStrategy(_defaultStrategy);
    }

    function _updateDefaultStrategy(address _defaultStrategy) internal {
        defaultStrategy = _defaultStrategy;
        emit DefaultStrategyUpdated(_defaultStrategy);
    }

    function updatePriceOracle(address _priceOracle) external onlyOwner {
        _updatePriceOracle(_priceOracle);
    }

    function _updatePriceOracle(address _priceOracle) internal {
        priceOracle = _priceOracle;
        emit PriceOracleUpdated(_priceOracle);
    }

    function updateSavingsAccount(address _savingsAccount) external onlyOwner {
        _updateSavingsAccount(_savingsAccount);
    }

    function _updateSavingsAccount(address _savingsAccount) internal {
        savingsAccount = _savingsAccount;
        emit SavingsAccountUpdated(_savingsAccount);
    }

    function updateProtocolFeeFraction(uint256 _protocolFee) external onlyOwner {
        _updateProtocolFeeFraction(_protocolFee);
    }

    function _updateProtocolFeeFraction(uint256 _protocolFee) internal {
        protocolFeeFraction = _protocolFee;
        emit ProtocolFeeFractionUpdated(_protocolFee);
    }

    function updateProtocolFeeCollector(address _protocolFeeCollector) external onlyOwner {
        _updateProtocolFeeCollector(_protocolFeeCollector);
    }

    function _updateProtocolFeeCollector(address _protocolFeeCollector) internal {
        protocolFeeCollector = _protocolFeeCollector;
        emit ProtocolFeeCollectorUpdated(_protocolFeeCollector);
    }

    function updateStrategyRegistry(address _strategyRegistry) public onlyOwner {
        _updateStrategyRegistry(_strategyRegistry);
    }

    function _updateStrategyRegistry(address _strategyRegistry) internal {
        require(_strategyRegistry != address(0), 'CL::I zero address');
        strategyRegistry = _strategyRegistry;
        emit StrategyRegistryUpdated(_strategyRegistry);
    }

    /**
     * @dev Used to Calculate Interest Per second on given principal and Interest rate
     * @param _principal principal Amount for which interest has to be calculated.
     * @param _borrowRate It is the Interest Rate at which Credit Line is approved
     * @return uint256 interest per second for the given parameters
     */
    function calculateInterest(
        uint256 _principal,
        uint256 _borrowRate,
        uint256 _timeElapsed
    ) public pure returns (uint256) {
        uint256 _interest = _principal.mul(_borrowRate).mul(_timeElapsed).div(10**30).div(yearInSeconds);

        return _interest;
    }

    /**
     * @dev Used to calculate interest accrued since last repayment
     * @param _id Hash of the credit line for which interest accrued has to be calculated
     * @return uint256 interest accrued over current borrowed amount since last repayment
     */

    function calculateInterestAccrued(uint256 _id) public view returns (uint256) {
        uint256 _lastPrincipleUpdateTime = creditLineUsage[_id].lastPrincipalUpdateTime;
        if (_lastPrincipleUpdateTime == 0) return 0;
        uint256 _timeElapsed = (block.timestamp).sub(_lastPrincipleUpdateTime);
        uint256 _interestAccrued = calculateInterest(
            creditLineUsage[_id].principal,
            creditLineInfo[_id].borrowRate,
            _timeElapsed
        );
        return _interestAccrued;
    }

    /**
     * @dev Used to calculate current debt of borrower against a credit line.
     * @param _id Hash of the credit line for which current debt has to be calculated
     * @return uint256 current debt of borrower
     */

    // maybe change interestAccruedTillPrincipalUpdate to interestAccruedTillLastPrincipalUpdate
    function calculateCurrentDebt(uint256 _id) public view returns (uint256) {
        uint256 _interestAccrued = calculateInterestAccrued(_id);
        uint256 _currentDebt = (creditLineUsage[_id].principal)
            .add(creditLineUsage[_id].interestAccruedTillPrincipalUpdate)
            .add(_interestAccrued)
            .sub(creditLineUsage[_id].totalInterestRepaid);
        return _currentDebt;
    }

    function calculateBorrowableAmount(uint256 _id) public returns (uint256) {
        require(
            creditLineInfo[_id].currentStatus == creditLineStatus.ACTIVE ||
                creditLineInfo[_id].currentStatus == creditLineStatus.REQUESTED,
            'CreditLine: Cannot only if credit line ACTIVE or REQUESTED'
        );
        (uint256 _ratioOfPrices, uint256 _decimals) = IPriceOracle(priceOracle).getLatestPrice(
            creditLineInfo[_id].collateralAsset,
            creditLineInfo[_id].borrowAsset
        );

        uint256 _totalCollateralToken = calculateTotalCollateralTokens(_id);

        uint256 _currentDebt = calculateCurrentDebt(_id);

        uint256 maxPossible = _totalCollateralToken.mul(_ratioOfPrices).div(creditLineInfo[_id].idealCollateralRatio).div(
            10**_decimals
        );

        if (maxPossible > creditLineInfo[_id].borrowLimit) {
            maxPossible = creditLineInfo[_id].borrowLimit;
        }
        if (maxPossible > _currentDebt) {
            return maxPossible.sub(_currentDebt);
        }
        return 0;
    }

    function updateinterestAccruedTillPrincipalUpdate(uint256 _id) internal {
        require(creditLineInfo[_id].currentStatus == creditLineStatus.ACTIVE, 'CreditLine: The credit line is not yet active.');

        uint256 _interestAccrued = calculateInterestAccrued(_id);
        uint256 _newInterestAccrued = (creditLineUsage[_id].interestAccruedTillPrincipalUpdate).add(_interestAccrued);
        creditLineUsage[_id].interestAccruedTillPrincipalUpdate = _newInterestAccrued;
    }

    function transferFromSavingsAccount(
        address _asset,
        uint256 _amount,
        address _sender,
        address _recipient
    ) internal {
        address[] memory _strategyList = IStrategyRegistry(strategyRegistry).getStrategies();
        ISavingsAccount _savingsAccount = ISavingsAccount(savingsAccount);
        uint256 _activeAmount;

        for (uint256 _index = 0; _index < _strategyList.length; _index++) {
            uint256 _liquidityShares = _savingsAccount.userLockedBalance(_sender, _asset, _strategyList[_index]);
            if (_liquidityShares == 0) {
                continue;
            }
            uint256 _tokenInStrategy = _liquidityShares;
            if (_strategyList[_index] != address(0)) {
                _tokenInStrategy = IYield(_strategyList[_index]).getTokensForShares(_liquidityShares, _asset);
            }

            uint256 _tokensToTransfer = _tokenInStrategy;
            if (_activeAmount.add(_tokenInStrategy) >= _amount) {
                _tokensToTransfer = (_amount.sub(_activeAmount));
            }
            _activeAmount = _activeAmount.add(_tokensToTransfer);
            _savingsAccount.transferFrom(_asset, _sender, _recipient, _strategyList[_index], _tokensToTransfer);

            if (_amount == _activeAmount) {
                return;
            }
        }
        revert('CreditLine::transferFromSavingsAccount - Insufficient balance');
    }

    /**
     * @dev used to request a credit line by a borrower
     * @param _requestTo Address to which creditLine is requested, if borrower creates request then lender address and if lennder creates then borrower address
     * @param _borrowLimit maximum borrow amount in a credit line
     * @param _liquidationThreshold threshold for liquidation
     * @param _borrowRate Interest Rate at which credit Line is requested
     */

    function request(
        address _requestTo,
        uint256 _borrowLimit,
        uint256 _liquidationThreshold,
        uint256 _borrowRate,
        bool _autoLiquidation,
        uint256 _collateralRatio,
        address _borrowAsset,
        address _collateralAsset,
        bool _requestAsLender
    ) public returns (uint256) {
        //require(userData[borrower].blockCreditLineRequests == true,
        //        "CreditLine: External requests blocked");
        require(IPriceOracle(priceOracle).doesFeedExist(_borrowAsset, _collateralAsset), 'CL: No price feed');
        require(_liquidationThreshold < _collateralRatio, 'CL: collateral ratio should be higher');

        address _lender = _requestTo;
        address _borrower = msg.sender;
        if(_requestAsLender) {
            _lender = msg.sender;
            _borrower = _requestTo;
        }

        uint256 _id = _createRequest(
            _lender,
            _borrower,
            _borrowLimit,
            _liquidationThreshold,
            _borrowRate,
            _autoLiquidation,
            _collateralRatio,
            _borrowAsset,
            _collateralAsset,
            _requestAsLender
        );

        emit CreditLineRequested(_id, _lender, _borrower);
        return _id;
    }

    function _createRequest(
        address _lender,
        address _borrower,
        uint256 _borrowLimit,
        uint256 _liquidationThreshold,
        uint256 _borrowRate,
        bool _autoLiquidation,
        uint256 _collateralRatio,
        address _borrowAsset,
        address _collateralAsset,
        bool _requestByLender
    ) internal returns (uint256) {
        require(_lender != _borrower, 'Lender and Borrower cannot be same addresses');
        uint256 _id = CreditLineCounter + 1;
        CreditLineCounter = _id;
        creditLineInfo[_id].currentStatus = creditLineStatus.REQUESTED;
        creditLineInfo[_id].borrower = _borrower;
        creditLineInfo[_id].lender = _lender;
        creditLineInfo[_id].borrowLimit = _borrowLimit;
        creditLineInfo[_id].autoLiquidation = _autoLiquidation;
        creditLineInfo[_id].idealCollateralRatio = _collateralRatio;
        creditLineInfo[_id].liquidationThreshold = _liquidationThreshold;
        creditLineInfo[_id].borrowRate = _borrowRate;
        creditLineInfo[_id].borrowAsset = _borrowAsset;
        creditLineInfo[_id].collateralAsset = _collateralAsset;
        creditLineInfo[_id].requestByLender = _requestByLender;
        return _id;
    }

    /**
     * @dev used to Accept a credit line by a specified lender
     * @param _id Credit line hash which represents the credit Line Unique Hash
     */
    function accept(uint256 _id) external {
        require(
            creditLineInfo[_id].currentStatus == creditLineStatus.REQUESTED,
            'CreditLine::acceptCreditLineLender - CreditLine is already accepted'
        );
        bool _requestByLender = creditLineInfo[_id].requestByLender;
        require(
           (msg.sender == creditLineInfo[_id].borrower && _requestByLender) ||
           (msg.sender == creditLineInfo[_id].lender && !_requestByLender),
           "Only Borrower or Lender who hasn't requested can accept"
        );
        creditLineInfo[_id].currentStatus = creditLineStatus.ACTIVE;
        emit CreditLineAccepted(_id);
    }

    function depositCollateral(
        uint256 _amount,
        uint256 _id,
        bool _fromSavingsAccount
    ) external payable nonReentrant ifCreditLineExists(_id) {
        require(creditLineInfo[_id].currentStatus == creditLineStatus.ACTIVE, 'CreditLine not active');
        _depositCollateral(_amount, _id, _fromSavingsAccount);
    }

    function _depositCollateral(
        uint256 _amount,
        uint256 _id,
        bool _fromSavingsAccount
    ) internal {
        address _collateralAsset = creditLineInfo[_id].collateralAsset;
        if (_fromSavingsAccount) {
            transferFromSavingsAccount(_collateralAsset, _amount, msg.sender, address(this));
        } else {
            address _strategy = defaultStrategy;
            ISavingsAccount _savingsAccount = ISavingsAccount(savingsAccount);
            if (_collateralAsset == address(0)) {
                require(msg.value == _amount, "CreditLine::_depositCollateral - value to transfer doesn't match argument");
            } else {
                IERC20(_collateralAsset).safeTransferFrom(msg.sender, address(this), _amount);
                if (_strategy == address(0)) {
                    IERC20(_collateralAsset).approve(address(_savingsAccount), _amount);
                } else {
                    IERC20(_collateralAsset).approve(_strategy, _amount);
                }
            }
            uint256 _sharesReceived = _savingsAccount.depositTo{value: msg.value}(
                _amount,
                _collateralAsset,
                _strategy,
                address(this)
            );
            collateralShareInStrategy[_id][_strategy] = collateralShareInStrategy[_id][_strategy].add(
                _sharesReceived
            );
        }
    }

    function _withdrawBorrowAmount(
        address _asset,
        uint256 _amountInTokens,
        address _lender
    ) internal {
        //address _lender = creditLineInfo[id].lender;
        address[] memory _strategyList = IStrategyRegistry(strategyRegistry).getStrategies();
        ISavingsAccount _savingsAccount = ISavingsAccount(savingsAccount);
        uint256 _activeAmount;
        for (uint256 _index = 0; _index < _strategyList.length; _index++) {
            uint256 _liquidityShares = _savingsAccount.userLockedBalance(_lender, _asset, _strategyList[_index]);
            if (_liquidityShares != 0) {
                uint256 tokenInStrategy = _liquidityShares;
                if (_strategyList[_index] != address(0)) {
                    tokenInStrategy = IYield(_strategyList[_index]).getTokensForShares(_liquidityShares, _asset);
                }
                uint256 _tokensToTransfer = tokenInStrategy;
                if (_activeAmount.add(tokenInStrategy) >= _amountInTokens) {
                    _tokensToTransfer = (_amountInTokens.sub(_activeAmount));
                }
                _activeAmount = _activeAmount.add(_tokensToTransfer);
                _savingsAccount.withdrawFrom(_lender, address(this), _tokensToTransfer, _asset, _strategyList[_index], false);
                if (_activeAmount == _amountInTokens) {
                    return;
                }
            }
        }
        require(_activeAmount == _amountInTokens, 'insufficient balance');
    }

    function borrow(uint256 amount, uint256 _id)
        external
        payable
        nonReentrant
        onlyCreditLineBorrower(_id)
    {
        require(creditLineInfo[_id].currentStatus == creditLineStatus.ACTIVE, 'CreditLine: The credit line is not yet active.');
        uint256 _currentDebt = calculateCurrentDebt(_id);
        require(_currentDebt.add(amount) <= creditLineInfo[_id].borrowLimit, 'CreditLine: Amount exceeds borrow limit.');

        (uint256 _ratioOfPrices, uint256 _decimals) = IPriceOracle(priceOracle).getLatestPrice(
            creditLineInfo[_id].collateralAsset,
            creditLineInfo[_id].borrowAsset
        );

        uint256 _totalCollateralToken = calculateTotalCollateralTokens(_id);

        uint256 collateralRatioIfAmountIsWithdrawn = _ratioOfPrices.mul(_totalCollateralToken).div(
            (_currentDebt.add(amount)).mul(10**_decimals)
        );
        require(
            collateralRatioIfAmountIsWithdrawn > creditLineInfo[_id].idealCollateralRatio,
            "CreditLine::borrow - The current collateral ratio doesn't allow to withdraw the amount"
        );
        address _borrowAsset = creditLineInfo[_id].borrowAsset;
        address _lender = creditLineInfo[_id].lender;

        updateinterestAccruedTillPrincipalUpdate(_id);
        creditLineUsage[_id].principal = creditLineUsage[_id].principal.add(amount);
        creditLineUsage[_id].lastPrincipalUpdateTime = block.timestamp;

        //transferFromSavingsAccount(_borrowAsset,amount,_lender,address(this)); // 10000000000000000000

        // @ TO-DO
        uint256 _tokenDiffBalance;
        if (_borrowAsset != address(0)) {
            uint256 _balanceBefore = IERC20(_borrowAsset).balanceOf(address(this));
            _withdrawBorrowAmount(_borrowAsset, amount, _lender);
            uint256 _balanceAfter = IERC20(_borrowAsset).balanceOf(address(this));
            _tokenDiffBalance = _balanceAfter.sub(_balanceBefore);
        } else {
            uint256 _balanceBefore = address(this).balance;
            _withdrawBorrowAmount(_borrowAsset, amount, _lender);
            uint256 _balanceAfter = address(this).balance;
            _tokenDiffBalance = _balanceAfter.sub(_balanceBefore);
        }

        uint256 _protocolFee = _tokenDiffBalance.mul(protocolFeeFraction).div(10**30);
        _tokenDiffBalance = _tokenDiffBalance.sub(_protocolFee);

        if (_borrowAsset == address(0)) {
            (bool feeSuccess, ) = protocolFeeCollector.call{value: _protocolFee}('');
            require(feeSuccess, 'Transfer fail');
            (bool success, ) = msg.sender.call{value: _tokenDiffBalance}('');
            require(success, 'Transfer fail');
        } else {
            IERC20(_borrowAsset).safeTransfer(protocolFeeCollector, _protocolFee);
            IERC20(_borrowAsset).safeTransfer(msg.sender, _tokenDiffBalance);
        }
        emit BorrowedFromCreditLine(_tokenDiffBalance, _id);
    }

    //TODO:- Make the function to accept ether as well
    /**
     * @dev used to repay assest to credit line
     * @param _repayAmount amount which borrower wants to repay to credit line
     * @param _id Credit line hash which represents the credit Line Unique Hash
     */

    /*
        Parameters used:
        - currentStatus
        - borrowAsset
        - interestAccruedTillPrincipalUpdate
        - principal
        - totalInterestRepaid
        - lastPrincipalUpdateTime



    */
    function repay(
        uint256 _id,
        bool _transferFromSavingsAccount,
        uint256 _repayAmount
    ) internal {
        address _borrowAsset = creditLineInfo[_id].borrowAsset;
        address _lender = creditLineInfo[_id].lender;
        ISavingsAccount _savingsAccount = ISavingsAccount(savingsAccount);
        address _defaultStrategy = defaultStrategy;
        if (!_transferFromSavingsAccount) {
            if (_borrowAsset == address(0)) {
                require(msg.value >= _repayAmount, 'creditLine::repay - value should be eq or more than repay amount');
                (bool success, ) = payable(msg.sender).call{value: msg.value.sub(_repayAmount)}(''); // transfer the remaining amount
                require(success, 'creditLine::repay - remainig value transfered successfully');
                _savingsAccount.depositTo{value: _repayAmount}(_repayAmount, _borrowAsset, _defaultStrategy, _lender);
            } else {
                _savingsAccount.depositTo(_repayAmount, _borrowAsset, _defaultStrategy, _lender);
            }
        } else {
            transferFromSavingsAccount(_borrowAsset, _repayAmount, msg.sender, creditLineInfo[_id].lender);
        }
        _savingsAccount.increaseAllowanceToCreditLine(_borrowAsset, _lender, _repayAmount);
    }

    function repay(
        uint256 _amount,
        uint256 _id,
        bool _transferFromSavingsAccount
    ) external payable nonReentrant {
        require(creditLineInfo[_id].currentStatus == creditLineStatus.ACTIVE, 'CreditLine: The credit line is not yet active.');

        uint256 _interestSincePrincipalUpdate = calculateInterestAccrued(_id);
        uint256 _totalInterestAccrued = (creditLineUsage[_id].interestAccruedTillPrincipalUpdate).add(
            _interestSincePrincipalUpdate
        );
        uint256 _totalDebt = _totalInterestAccrued.add(creditLineUsage[_id].principal);

        bool _totalRemainingIsRepaid = false;

        if (_amount > _totalDebt) {
            _totalRemainingIsRepaid = true;
            _amount = _totalDebt;
        }

        uint256 _totalRepaidNow = creditLineUsage[_id].totalInterestRepaid.add(_amount);

        if (_totalRepaidNow > _totalInterestAccrued) {
            creditLineUsage[_id].principal = (creditLineUsage[_id].principal).add(_totalInterestAccrued).sub(
                _totalRepaidNow
            );
            creditLineUsage[_id].interestAccruedTillPrincipalUpdate = _totalInterestAccrued;
            creditLineUsage[_id].lastPrincipalUpdateTime = block.timestamp;
        }
        creditLineUsage[_id].totalInterestRepaid = _totalRepaidNow;
        repay(_id, _transferFromSavingsAccount, _amount);

        if (creditLineUsage[_id].principal == 0) {
            _resetCreditLine(_id);
        }

        if (_totalRemainingIsRepaid) {
            emit CompleteCreditLineRepaid(_id, _amount);
        } else {
            emit PartialCreditLineRepaid(_id, _amount);
        }
    }

    function _resetCreditLine(uint256 id) internal {
        creditLineUsage[id].lastPrincipalUpdateTime = 0; // check if can assign 0 or not
        creditLineUsage[id].totalInterestRepaid = 0;
        creditLineUsage[id].interestAccruedTillPrincipalUpdate = 0;
        emit CreditLineReset(id);
    }

    /**
     * @dev used to close credit line once by borrower or lender
     * @param _id Credit line hash which represents the credit Line Unique Hash
     */
    function close(uint256 _id) external ifCreditLineExists(_id) {
        require(
            msg.sender == creditLineInfo[_id].borrower || msg.sender == creditLineInfo[_id].lender,
            'CreditLine: Permission denied while closing Line of credit'
        );
        require(creditLineInfo[_id].currentStatus == creditLineStatus.ACTIVE, 'CreditLine: Credit line should be active.');
        require(creditLineUsage[_id].principal == 0, 'CreditLine: Cannot be closed since not repaid.');
        require(creditLineUsage[_id].interestAccruedTillPrincipalUpdate == 0, 'CreditLine: Cannot be closed since not repaid.');
        creditLineInfo[_id].currentStatus = creditLineStatus.CLOSED;
        emit CreditLineClosed(_id);
    }

    function calculateCurrentCollateralRatio(uint256 _id) public ifCreditLineExists(_id) returns (uint256) {
        (uint256 _ratioOfPrices, uint256 _decimals) = IPriceOracle(priceOracle).getLatestPrice(
            creditLineInfo[_id].collateralAsset,
            creditLineInfo[_id].borrowAsset
        );

        uint256 currentDebt = calculateCurrentDebt(_id);
        uint256 currentCollateralRatio = calculateTotalCollateralTokens(_id).mul(_ratioOfPrices).div(currentDebt).div(
            10**_decimals
        );
        return currentCollateralRatio;
    }

    function calculateTotalCollateralTokens(uint256 _id) public returns (uint256 amount) {
        address _collateralAsset = creditLineInfo[_id].collateralAsset;
        address[] memory _strategyList = IStrategyRegistry(strategyRegistry).getStrategies();
        uint256 liquidityShares;
        for (uint256 index = 0; index < _strategyList.length; index++) {
            liquidityShares = collateralShareInStrategy[_id][_strategyList[index]];
            uint256 tokenInStrategy = liquidityShares;
            if (_strategyList[index] != address(0)) {
                tokenInStrategy = IYield(_strategyList[index]).getTokensForShares(liquidityShares, _collateralAsset);
            }

            amount = amount.add(tokenInStrategy);
        }
    }

    function withdrawCollateral(uint256 _id, uint256 amount)
        external
        nonReentrant
        onlyCreditLineBorrower(_id)
    {
        //check for ideal ratio
        (uint256 _ratioOfPrices, uint256 _decimals) = IPriceOracle(priceOracle).getLatestPrice(
            creditLineInfo[_id].collateralAsset,
            creditLineInfo[_id].borrowAsset
        );

        uint256 _totalCollateralToken = calculateTotalCollateralTokens(_id);
        uint256 currentDebt = calculateCurrentDebt(_id);
        if (currentDebt != 0) {
            uint256 collateralRatioIfAmountIsWithdrawn = ((_totalCollateralToken.sub(amount)).mul(_ratioOfPrices).div(currentDebt)).div(
                10**_decimals
            );
            require(
                collateralRatioIfAmountIsWithdrawn >= creditLineInfo[_id].idealCollateralRatio,
                "CreditLine::withdrawCollateralFromCreditLine - The current collateral ration doesn't allow to withdraw"
            );
        }
        address _collateralAsset = creditLineInfo[_id].collateralAsset;
        _withdrawCollateral(_collateralAsset, amount, _id);
    }

    function _withdrawCollateral(
        address _asset,
        uint256 _amountInTokens,
        uint256 _id
    ) internal {
        address[] memory _strategyList = IStrategyRegistry(strategyRegistry).getStrategies();
        uint256 _activeAmount;
        for (uint256 index = 0; index < _strategyList.length; index++) {
            uint256 liquidityShares = collateralShareInStrategy[_id][_strategyList[index]];
            if (liquidityShares == 0) {
                continue;
            }
            uint256 _tokenInStrategy = liquidityShares;
            if (_strategyList[index] != address(0)) {
                _tokenInStrategy = IYield(_strategyList[index]).getTokensForShares(liquidityShares, _asset);
            }
            uint256 _tokensToTransfer = _tokenInStrategy;
            if (_activeAmount.add(_tokenInStrategy) > _amountInTokens) {
                _tokensToTransfer = _amountInTokens.sub(_activeAmount);
                liquidityShares = liquidityShares.mul(_tokensToTransfer).div(_tokenInStrategy);
            }
            _activeAmount = _activeAmount.add(_tokensToTransfer);
            collateralShareInStrategy[_id][_strategyList[index]] = collateralShareInStrategy[_id][
                _strategyList[index]
            ].sub(liquidityShares);
            ISavingsAccount(savingsAccount).withdraw(msg.sender, _tokensToTransfer, _asset, _strategyList[index], false);

            if (_activeAmount == _amountInTokens) {
                return;
            }
        }
        revert('insufficient collateral');
    }

    function liquidate(uint256 _id) external payable nonReentrant {
        require(creditLineInfo[_id].currentStatus == creditLineStatus.ACTIVE, 'CreditLine: Credit line should be active.');

        uint256 currentCollateralRatio = calculateCurrentCollateralRatio(_id);
        require(
            currentCollateralRatio < creditLineInfo[_id].liquidationThreshold,
            'CreditLine: Collateral ratio is higher than liquidation threshold'
        );

        address _collateralAsset = creditLineInfo[_id].collateralAsset;
        address _lender = creditLineInfo[_id].lender;
        uint256 _totalCollateralToken = calculateTotalCollateralTokens(_id);
        address _borrowAsset = creditLineInfo[_id].borrowAsset;

        creditLineInfo[_id].currentStatus = creditLineStatus.LIQUIDATED;

        if (creditLineInfo[_id].autoLiquidation) {
            if (_lender == msg.sender) {
                transferFromSavingsAccount(_collateralAsset, _totalCollateralToken, address(this), msg.sender);
            } else {
                (uint256 _ratioOfPrices, uint256 _decimals) = IPriceOracle(priceOracle).getLatestPrice(_borrowAsset, _collateralAsset);

                uint256 _borrowToken = (_totalCollateralToken.mul(_ratioOfPrices).div(10**_decimals));
                IERC20(_borrowAsset).safeTransferFrom(msg.sender, _lender, _borrowToken);
                _withdrawCollateral(_collateralAsset, _totalCollateralToken, _id);
            }
        } else {
            require(msg.sender == _lender, 'CreditLine: Liquidation can only be performed by lender.');
            transferFromSavingsAccount(_collateralAsset, _totalCollateralToken, address(this), msg.sender);
        }

        emit CreditLineLiquidated(_id, msg.sender);
    }

    receive() external payable {
        require(msg.sender == savingsAccount, 'CreditLine::receive invalid transaction');
    }

    // Think about threshHold liquidation
    // only one type of token is accepted check for that
    // collateral ratio has to calculated initially
    // current debt is more than borrow amount
}
