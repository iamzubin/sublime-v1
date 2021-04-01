// SPDX-License-Identifier: MIT
pragma solidity 0.7.0;

import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./CreditLineStorage.sol";
import "../interfaces/IPoolFactory.sol";
import "../interfaces/IPriceOracle.sol";
import "../interfaces/IYield.sol";
import "../interfaces/IRepayment.sol";
import "../interfaces/ISavingsAccount.sol";
import "../interfaces/IStrategyRegistry.sol";
/**
 * @title Credit Line contract with Methods related to credit Line
 * @notice Implements the functions related to Credit Line
 * @author Sublime
 **/

contract CreditLine is CreditLineStorage, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using SafeMath for uint256;

    address public PoolFactory;
    address public strategyRegistry;
    address public defaultStrategy;
    /**
     * @dev checks if Credit Line exists
     * @param creditLineHash credit hash
     **/
    modifier ifCreditLineExists(bytes32 creditLineHash) {
        require(
            creditLineInfo[creditLineHash].borrowLimit != 0,
            "Credit line does not exist"
        );
        _;
    }

    /**
     * @dev checks if called by credit Line Borrower
     * @param creditLineHash creditLine Hash
     **/
    modifier onlyCreditLineBorrower(bytes32 creditLineHash) {
        require(
            creditLineInfo[creditLineHash].borrower == msg.sender,
            "Only credit line Borrower can access"
        );
        _;
    }

    /**
     * @dev checks if called by credit Line Lender
     * @param creditLineHash creditLine Hash
     **/
    modifier onlyCreditLineLender(bytes32 creditLineHash) {
        require(
            creditLineInfo[creditLineHash].lender == msg.sender,
            "Only credit line Lender can access"
        );
        _;
    }

    event CreditLineRequestedToLender(bytes32 creditLineHash, address lender, address borrower);
    event CreditLineRequestedToBorrower(bytes32 creditLineHash, address lender, address borrower);
    event BorrowedFromCreditLine(uint256 borrowAmount, bytes32 creditLineHash);
    event CreditLineAccepted(bytes32 creditLineHash);
    event CreditLineReset(bytes32 creditLineHash);
    event PartialCreditLineRepaid(bytes32 creditLineHash, uint256 repayAmount);
    event CreditLineClosed(bytes32 creditLineHash);

    function initialize(address _defaultStrategy) public initializer {
        __Ownable_init();
        defaultStrategy = _defaultStrategy;
    }


    /**
     * @dev Used to Calculate Interest Per second on given principal and Interest rate
     * @param _principal principal Amount for which interest has to be calculated.
     * @param _borrowRate It is the Interest Rate at which Credit Line is approved
    * @return uint256 interest per second for the given parameters
    */
    function calculateInterestPerSecond(uint256 _principal, uint256 _borrowRate)
        public
        pure
        returns (uint256)
    {
        uint256 _interest = (_principal.mul(_borrowRate)).div(yearInSeconds);
        return _interest;
    }


    /**
     * @dev Used to calculate interest accrued since last repayment
     * @param creditLineHash Hash of the credit line for which interest accrued has to be calculated
     * @return uint256 interest accrued over current borrowed amount since last repayment
    */

    function calculateInterestAccrued(bytes32 creditLineHash)
        public
        view
        returns (uint256)
    {
        uint256 _timeElapsed = (block.timestamp).sub(creditLineUsage[creditLineHash].lastPrincipalUpdateTime);
        uint256 _interestAccrued = calculateInterestPerSecond(
                                        creditLineUsage[creditLineHash].principal,
                                        creditLineInfo[creditLineHash].borrowRate
                                    ).mul(_timeElapsed);
        return _interestAccrued;
    }

    /**
     * @dev Used to calculate current debt of borrower against a credit line. 
     * @param _creditLineHash Hash of the credit line for which current debt has to be calculated
     * @return uint256 current debt of borrower 
    */

    // maybe change interestAccruedTillPrincipalUpdate to interestAccruedTillLastPrincipalUpdate
    function calculateCurrentDebt(bytes32 _creditLineHash)
        public
        view
        returns (uint256)
    {
        uint256 _interestAccrued = calculateInterestAccrued(_creditLineHash);
        uint256 _currentDebt =
            (creditLineUsage[_creditLineHash].principal)
                .add(creditLineUsage[_creditLineHash].interestAccruedTillPrincipalUpdate)
                .add(_interestAccrued)
                .sub(creditLineUsage[_creditLineHash].totalInterestRepaid);
        return _currentDebt;
    }

    function updateinterestAccruedTillPrincipalUpdate(bytes32 creditLineHash)
        internal
    {

        require(creditLineInfo[creditLineHash].currentStatus == creditLineStatus.ACTIVE,
                "CreditLine: The credit line is not yet active.");

        uint256 _interestAccrued = calculateInterestAccrued(creditLineHash);
        uint256 _newInterestAccrued = (creditLineUsage[creditLineHash].interestAccruedTillPrincipalUpdate)
                                        .add(_interestAccrued);
        creditLineUsage[creditLineHash].interestAccruedTillPrincipalUpdate = _newInterestAccrued;
    }

    function getTotalTokensInStrategies(address _sender, address _asset) public returns(uint256 _totalTokens) {
        address[] memory _strategyList = IStrategyRegistry(strategyRegistry).getStrategies();

        ISavingsAccount _savingsAccount = ISavingsAccount(IPoolFactory(PoolFactory).savingsAccount());
        
        for (uint256 _index = 0; _index < _strategyList.length; _index++) {
            
            uint256 _liquidityShares = _savingsAccount.userLockedBalance(_sender, _asset, _strategyList[_index]);
            
            if (_liquidityShares != 0) {
                uint256 _tokenInStrategy = IYield(_strategyList[_index]).getTokensForShares(_liquidityShares, _asset);
                _totalTokens = _totalTokens.add(_tokenInStrategy);
            }
        }
    }

     function transferFromSavingAccount(address _asset, uint256 _amount, address _sender, address _recipient) internal {

        address[] memory _strategyList = IStrategyRegistry(strategyRegistry).getStrategies();
        ISavingsAccount _savingsAccount = ISavingsAccount(IPoolFactory(PoolFactory).savingsAccount());
        uint256 _activeAmount;

        for (uint256 _index = 0; _index < _strategyList.length; _index++) {
            uint256 _liquidityShares = _savingsAccount.userLockedBalance(_sender, _asset, _strategyList[_index]);
            if (_liquidityShares > 0) {
                uint256 _tokenInStrategy = IYield(_strategyList[_index]).getTokensForShares(_liquidityShares, _asset);

                //_activeAmount = _activeAmount.add(_tokenInStrategy);

                if(_activeAmount.add(_tokenInStrategy) >= _amount) {
                    uint256 _sharesToTransfer = (_amount.sub(_activeAmount)).div(_tokenInStrategy).mul(_liquidityShares);
                    _savingsAccount.transferFrom(_asset, _sender, _recipient, _strategyList[_index], _sharesToTransfer);
                    return;
                }

                else {
                    _activeAmount = _activeAmount.add(_tokenInStrategy);
                    _savingsAccount.transferFrom(_asset, _sender, _recipient, _strategyList[_index], _liquidityShares);
                }
   
            }
        }
        revert("CreditLine::transferFromSavingAccount - Insufficient balance");
    }


    function _transferCollateral(uint256 _amount, bytes32 _creditLineHash, address _recipient) internal {
        address[] memory _strategyList = IStrategyRegistry(strategyRegistry).getStrategies();
        uint256 _activeAmount;

        ISavingsAccount _savingsAccount = ISavingsAccount(IPoolFactory(PoolFactory).savingsAccount());

        for (uint256 _index = 0; _index < _strategyList.length; _index++) {
            // TODO: Rename the  userrLockedBalance to something else
            uint256 _liquidityShares = _savingsAccount.userLockedBalance(creditLineInfo[_creditLineHash].borrower, creditLineInfo[_creditLineHash].collateralAsset, _strategyList[_index]);
            uint256 _sharesToTransfer = _liquidityShares;
            if (_liquidityShares != 0) {
                uint256 _tokenInStrategy = IYield(_strategyList[_index]).getTokensForShares(_liquidityShares, creditLineInfo[_creditLineHash].collateralAsset);

                if (_activeAmount.add(_tokenInStrategy) >= _amount) {
                    _sharesToTransfer = (_amount.sub(_activeAmount)).mul(_liquidityShares).div(_tokenInStrategy);
                    return;
                }
                _activeAmount = _activeAmount.add(_tokenInStrategy);
                _savingsAccount.transferFrom(creditLineInfo[_creditLineHash].collateralAsset, creditLineInfo[_creditLineHash].borrower, _recipient, _strategyList[_index], _sharesToTransfer);
                collateralShareInStrategy[_creditLineHash][_strategyList[_index]] = collateralShareInStrategy[_creditLineHash][_strategyList[_index]]
                                                                                    .add(_sharesToTransfer);
            }
        }
        revert("CreditLine::_transferCollateral - Savings account doesn't have enough funds");
    }

    /**
     * @dev used to request a credit line by a borrower
     * @param _lender lender from whom creditLine is requested
     * @param _borrowLimit maximum borrow amount in a credit line
     * @param _liquidationThreshold threshold for liquidation 
     * @param _borrowRate Interest Rate at which credit Line is requested
    */
    function requestCreditLineToLender(
        address _lender,
        uint256 _borrowLimit,
        uint256 _liquidationThreshold,
        uint256 _borrowRate,
        bool _autoLiquidation,
        uint256 _collateralRatio,
        address _borrowAsset,
        address _collateralAsset
    ) public returns (bytes32) {

        //require(userData[lender].blockCreditLineRequests == true,
        //        "CreditLine: External requests blocked");
        bytes32 _creditLineHash = _createCreditLineRequest(
            _lender,
            msg.sender,
            _borrowLimit,
            _liquidationThreshold,
            _borrowRate,
            _autoLiquidation,
            _collateralRatio,
            _borrowAsset,
            _collateralAsset,
            false
        );
        // setRepayments(creditLineHash);
        emit CreditLineRequestedToLender(_creditLineHash, _lender, msg.sender);
        return _creditLineHash;

    }

    function requestCreditLineToBorrower(
        address _borrower,
        uint256 _borrowLimit,
        uint256 _liquidationThreshold,
        uint256 _borrowRate,
        bool _autoLiquidation,
        uint256 _collateralRatio,
        address _borrowAsset,
        address _collateralAsset
    ) public returns (bytes32) {

        //require(userData[borrower].blockCreditLineRequests == true,
        //        "CreditLine: External requests blocked");
        bytes32 _creditLineHash = _createCreditLineRequest(
            msg.sender,
            _borrower,
            _borrowLimit,
            _liquidationThreshold,
            _borrowRate,
            _autoLiquidation,
            _collateralRatio,
            _borrowAsset,
            _collateralAsset,
            true
        );
        // setRepayments(creditLineHash);
        ISavingsAccount(IPoolFactory(PoolFactory).savingsAccount()).approve(_borrowAsset, address(this), _borrowLimit);
        emit CreditLineRequestedToBorrower(_creditLineHash, msg.sender, _borrower);
        return _creditLineHash;

    }

    function _createCreditLineRequest(
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
    ) internal returns(bytes32 creditLineHash) {
        CreditLineCounter = CreditLineCounter + 1; // global counter to generate ID
        bytes32 _creditLineHash = keccak256(abi.encodePacked(CreditLineCounter));
        creditLineInfo[_creditLineHash].currentStatus = creditLineStatus.REQUESTED;
        creditLineInfo[_creditLineHash].borrower = _borrower;
        creditLineInfo[_creditLineHash].lender = _lender;
        creditLineInfo[_creditLineHash].borrowLimit = _borrowLimit;
        creditLineInfo[_creditLineHash].autoLiquidation = _autoLiquidation;
        creditLineInfo[_creditLineHash].idealCollateralRatio = _collateralRatio;
        creditLineInfo[_creditLineHash].liquidationThreshold = _liquidationThreshold;
        creditLineInfo[_creditLineHash].borrowRate = _borrowRate;
        creditLineInfo[_creditLineHash].borrowAsset = _borrowAsset;
        creditLineInfo[_creditLineHash].collateralAsset = _collateralAsset;
        creditLineInfo[_creditLineHash].requestByLender = _requestByLender;
        return _creditLineHash;
    }
    
    /**
     * @dev used to Accept a credit line by a specified lender
     * @param _creditLineHash Credit line hash which represents the credit Line Unique Hash
    */
    function acceptCreditLineLender(bytes32 _creditLineHash)
        external
        onlyCreditLineLender(_creditLineHash)
    {
        _acceptCreditLine(_creditLineHash, false);
        ISavingsAccount(IPoolFactory(PoolFactory).savingsAccount()).approve(creditLineInfo[_creditLineHash].borrowAsset, address(this), creditLineInfo[_creditLineHash].borrowLimit);
    }

    function acceptCreditLineBorrower(bytes32 _creditLineHash)
        external
        onlyCreditLineBorrower(_creditLineHash)
    {
        _acceptCreditLine(_creditLineHash, true);
    }

    function _acceptCreditLine(bytes32 _creditLineHash, bool _requestByLender) internal {
        require(creditLineInfo[_creditLineHash].currentStatus == creditLineStatus.REQUESTED,
                "CreditLine::acceptCreditLineLender - CreditLine is already accepted");
        require(creditLineInfo[_creditLineHash].requestByLender == _requestByLender,
                "CreditLine::acceptCreditLineLender - Invalid request");

        creditLineInfo[_creditLineHash].currentStatus = creditLineStatus.ACTIVE;
        emit CreditLineAccepted(_creditLineHash);
    }


    function depositCollateral(
        address _collateralAsset, 
        uint256 _collateralAmount,
        bytes32 _creditLineHash, 
        bool _fromSavingAccount
    ) 
    public 
    payable
    ifCreditLineExists(_creditLineHash)
    {
        if(_fromSavingAccount){
            // TODO: can we simplify the _transferCollateral logic by  allowing deposit only if depositor has enough collateralAsset
            _transferCollateral(_collateralAmount, _creditLineHash, address(this));
        }
        else{
            address _strategy = defaultStrategy;
            ISavingsAccount _savingsAccount = ISavingsAccount(IPoolFactory(PoolFactory).savingsAccount());
            if(_collateralAsset == address(0)){
                require(msg.value == _collateralAmount, "CreditLine ::borrowFromCreditLine - value to transfer doesn't match argument");
            }
            else{
                IERC20(_collateralAsset).safeTransferFrom(msg.sender, address(this), _collateralAmount);
                IERC20(_collateralAsset).approve(address(_savingsAccount), _collateralAmount);
            }
            uint256 _sharesReceived = _savingsAccount.depositTo{value:msg.value}(_collateralAmount, _collateralAsset, _strategy, address(this));
            collateralShareInStrategy[_creditLineHash][_strategy] = collateralShareInStrategy[_creditLineHash][_strategy].add(_sharesReceived);
        }

    }

    function _withdrawBorrowAmount(address _asset, uint256 _amountInTokens, bytes32 _creditLineHash, address _lender) internal {

        //address _lender = creditLineInfo[creditLineHash].lender;
        address[] memory _strategyList = IStrategyRegistry(strategyRegistry).getStrategies();
        ISavingsAccount _savingsAccount = ISavingsAccount(IPoolFactory(PoolFactory).savingsAccount());
        uint256 _activeAmount;
        uint256 _tokenInStrategy;
        for (uint256 _index = 0; _index < _strategyList.length; _index++) {

            uint256 _liquidityShares = _savingsAccount.userLockedBalance(_lender, _asset, _strategyList[_index]);
            if (_liquidityShares != 0) {
                _tokenInStrategy = IYield(_strategyList[_index]).getTokensForShares(_liquidityShares, _asset); //TODO might not pass since yield is included in tokenInStrategy
                uint256 _sharesToTransfer = _liquidityShares;
                if (_activeAmount.add(_tokenInStrategy) >= _amountInTokens) {
                    _sharesToTransfer = (_amountInTokens.sub(_activeAmount)).div(_tokenInStrategy).mul(_liquidityShares);
                    _savingsAccount.withdrawFrom(_lender, address(this), _sharesToTransfer, _asset, _strategyList[_index], false);
                    //_savingsAccount.transferFrom(_asset, _sender, _recipient, _strategyList[_index], _sharesToTransfer);
                    collateralShareInStrategy[_creditLineHash][_strategyList[_index]] = collateralShareInStrategy[_creditLineHash][_strategyList[_index]]
                                                                                        .add(_sharesToTransfer);
                    return;
                }
                else {
                    _activeAmount = _activeAmount.add(_tokenInStrategy);
                }
                _savingsAccount.withdrawFrom(_lender, address(this), _liquidityShares, _asset, _strategyList[_index], false);
                //_savingsAccount.transferFrom(_asset, _sender, _recipient, _strategyList[_index], _liquidityShares);
                collateralShareInStrategy[_creditLineHash][_strategyList[_index]] = collateralShareInStrategy[_creditLineHash][_strategyList[_index]]
                                                                                    .add(_liquidityShares);
            }
        }
        require(_activeAmount == _amountInTokens,"insufficient balance");
    }


    function borrowFromCreditLine(uint256 borrowAmount, bytes32 creditLineHash)
        external payable
        nonReentrant
        onlyCreditLineBorrower(creditLineHash)
    {   

        require(creditLineInfo[creditLineHash].currentStatus == creditLineStatus.ACTIVE,
                "CreditLine: The credit line is not yet active.");
        uint256 _currentDebt = calculateCurrentDebt(creditLineHash);
        require(
            _currentDebt.add(borrowAmount) <= creditLineInfo[creditLineHash].borrowLimit,
            "CreditLine: Amount exceeds borrow limit.");

        uint256 _ratioOfPrices =
            IPriceOracle(IPoolFactory(PoolFactory).priceOracle())
                .getLatestPrice(
                    creditLineInfo[creditLineHash].collateralAsset,
                    creditLineInfo[creditLineHash].borrowAsset
                );

        uint256 _totalCollateralToken = calculateTotalCollateralTokens(creditLineHash);
        uint256 collateralRatioIfAmountIsWithdrawn = _ratioOfPrices.mul(_totalCollateralToken).div(_currentDebt.add(borrowAmount));
        require(
            collateralRatioIfAmountIsWithdrawn >
                creditLineInfo[creditLineHash].idealCollateralRatio,
            "CreditLine::borrowFromCreditLine - The current collateral ratio doesn't allow to withdraw the amount"
        );
        address _borrowAsset = creditLineInfo[creditLineHash].borrowAsset;
        address _lender = creditLineInfo[creditLineHash].lender;
    
        updateinterestAccruedTillPrincipalUpdate(creditLineHash);
        creditLineUsage[creditLineHash].principal = creditLineUsage[creditLineHash].principal.add(borrowAmount);
        creditLineUsage[creditLineHash].lastPrincipalUpdateTime = block.timestamp;

        //transferFromSavingAccount(_borrowAsset,borrowAmount,_lender,address(this));
        _withdrawBorrowAmount(_borrowAsset, borrowAmount, creditLineHash, _lender);
        if(_borrowAsset==address(0)){
            msg.sender.transfer(borrowAmount);
        }
        else{
            IERC20(_borrowAsset).safeTransfer(msg.sender, borrowAmount);
        }
        emit BorrowedFromCreditLine(borrowAmount, creditLineHash);
    }


    //TODO:- Make the function to accept ether as well 
    /**
     * @dev used to repay assest to credit line 
     * @param _repayAmount amount which borrower wants to repay to credit line
     * @param _creditLineHash Credit line hash which represents the credit Line Unique Hash
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
    function repay(bytes32 _creditLineHash, bool _transferFromSavingAccount, uint256 _repayAmount) internal {

        address _borrowAsset = creditLineInfo[_creditLineHash].borrowAsset;
        address _lender = creditLineInfo[_creditLineHash].lender;
        ISavingsAccount _savingsAccount = ISavingsAccount(IPoolFactory(PoolFactory).savingsAccount());
        address _defaultStrategy = defaultStrategy;
        if(!_transferFromSavingAccount){
            if(_borrowAsset == address(0)){
                require(msg.value == _repayAmount, "creditLine::repay - value to transfer doesn't match argument");
                _savingsAccount.depositTo{value:msg.value}(_repayAmount, _borrowAsset, _defaultStrategy, _lender);
            }
            else{
                _savingsAccount.depositTo(_repayAmount, _borrowAsset, _defaultStrategy, _lender);
            }
        }
        else{
            transferFromSavingAccount(_borrowAsset, _repayAmount, msg.sender, creditLineInfo[_creditLineHash].lender);
        }
        _savingsAccount.approveFromToCreditLine(_borrowAsset, _lender, _repayAmount);

    }


    function repayCreditLine(uint256 repayAmount, bytes32 creditLineHash, bool _transferFromSavingAccount)
        external payable
        // TODO: Anyone can repay credit line
        onlyCreditLineBorrower(creditLineHash)
    {   
        require(creditLineInfo[creditLineHash].currentStatus == creditLineStatus.ACTIVE,
                "CreditLine: The credit line is not yet active.");

        uint256 _interestSincePrincipalUpdate = calculateInterestAccrued(creditLineHash);
        uint256 _totalInterestAccrued = (creditLineUsage[creditLineHash].interestAccruedTillPrincipalUpdate)
                                        .add(_interestSincePrincipalUpdate);
        uint256 _totalDebt = _totalInterestAccrued.add(creditLineUsage[creditLineHash].principal);
        uint256 _totalRepaidNow = creditLineUsage[creditLineHash].totalInterestRepaid.add(repayAmount);
        // check requried for correct token type
        //uint256 _currentDebt = calculateCurrentDebt(creditLineHash);
        require(_totalDebt >= repayAmount,
                "CreditLine: Repay amount is greater than debt.");

        if (_totalRepaidNow > _totalInterestAccrued) {
            creditLineUsage[creditLineHash].principal = (creditLineUsage[creditLineHash].principal)
                                                        .add(_totalInterestAccrued)
                                                        .sub(_totalRepaidNow);
            creditLineUsage[creditLineHash].interestAccruedTillPrincipalUpdate = _totalInterestAccrued;
            creditLineUsage[creditLineHash].lastPrincipalUpdateTime = block.timestamp;
        }
        creditLineUsage[creditLineHash].totalInterestRepaid = _totalRepaidNow;
        repay(creditLineHash,_transferFromSavingAccount,repayAmount);

        if (creditLineUsage[creditLineHash].principal == 0) {
            _resetCreditLine(creditLineHash);
        }
        PartialCreditLineRepaid(creditLineHash, repayAmount);
    }

    function _resetCreditLine(bytes32 creditLineHash) internal {
        creditLineUsage[creditLineHash].lastPrincipalUpdateTime = 0; // check if can assign 0 or not
        creditLineUsage[creditLineHash].totalInterestRepaid = 0;
        creditLineUsage[creditLineHash].interestAccruedTillPrincipalUpdate = 0;
        emit CreditLineReset(creditLineHash);
    }

    /**
     * @dev used to close credit line once by borrower or lender  
     * @param creditLineHash Credit line hash which represents the credit Line Unique Hash
    */
    function closeCreditLine(bytes32 creditLineHash)
        external
        ifCreditLineExists(creditLineHash)
    {
        require(
            msg.sender == creditLineInfo[creditLineHash].borrower ||
                msg.sender == creditLineInfo[creditLineHash].lender,
            "CreditLine: Permission denied while closing Line of credit"
        );
        require(creditLineInfo[creditLineHash].currentStatus == creditLineStatus.ACTIVE,
                "CreditLine: Credit line should be active.");
        require(creditLineUsage[creditLineHash].principal == 0,
                "CreditLine: Cannot be closed since not repaid.");
        require(creditLineUsage[creditLineHash].interestAccruedTillPrincipalUpdate == 0,
                "CreditLine: Cannot be closed since not repaid.");
        creditLineInfo[creditLineHash].currentStatus = creditLineStatus.CLOSED;
        emit CreditLineClosed(creditLineHash);
    }

    function calculateCurrentCollateralRatio(bytes32 creditLineHash) 
        public 
        view 
        ifCreditLineExists(creditLineHash) returns (uint256) {

        uint256 _ratioOfPrices =
            IPriceOracle(IPoolFactory(PoolFactory).priceOracle())
                .getLatestPrice(
                creditLineInfo[creditLineHash].collateralAsset,
                creditLineInfo[creditLineHash].borrowAsset);

        uint256 currentDebt = calculateCurrentDebt(creditLineHash);
        // TODO: Why  is collateral amount not used this way in other places (does this not  lead to loss  of precision ?)
        uint256 currentCollateralRatio = ((creditLineUsage[creditLineHash].collateralAmount).div(currentDebt)).mul(_ratioOfPrices).div(10**8);
        return currentCollateralRatio;
    }

    function calculateTotalCollateralTokens(bytes32 creditLineHash) public returns(uint256 amount){
        address _collateralAsset = creditLineInfo[creditLineHash].collateralAsset;
        address[] memory _strategyList = IStrategyRegistry(strategyRegistry).getStrategies();
        uint256 liquidityShares;
        for (uint256 index = 0; index < _strategyList.length; index++) {
            liquidityShares = collateralShareInStrategy[creditLineHash][_strategyList[index]];
            uint256 tokenInStrategy = IYield(_strategyList[index]).getTokensForShares(liquidityShares, _collateralAsset);
            amount = amount.add(tokenInStrategy);
        }
    }

    function withdrawCollateralFromCreditLine(bytes32 creditLineHash,uint256 amount) public onlyCreditLineBorrower(creditLineHash){

        //check for ideal ratio
        uint256 _ratioOfPrices =
            IPriceOracle(IPoolFactory(PoolFactory).priceOracle())
                .getLatestPrice(
                creditLineInfo[creditLineHash].collateralAsset,
                creditLineInfo[creditLineHash].borrowAsset);

        uint256 _totalCollateralToken = calculateTotalCollateralTokens(creditLineHash);
        uint256 currentDebt = calculateCurrentDebt(creditLineHash);
        // TODO: Shouldn't amounnt be removed from totalCollateralTokens
        uint256 collateralRatioIfAmountIsWithdrawn = ((_totalCollateralToken).mul(_ratioOfPrices).div(currentDebt.add(amount))).div(10**8);
        require(
            collateralRatioIfAmountIsWithdrawn >=
                creditLineInfo[creditLineHash].idealCollateralRatio,
            "CreditLine::withdrawCollateralFromCreditLine - The current collateral ration doesn't allow to withdraw"
        );
        address _collateralAsset = creditLineInfo[creditLineHash].collateralAsset;
        _withdrawCollateral(_collateralAsset, amount, creditLineHash);
    }


    function _withdrawCollateral(address _asset, uint256 _amountInTokens, bytes32 creditLineHash) internal {

        address[] memory _strategyList = IStrategyRegistry(strategyRegistry).getStrategies();
        uint256 _activeAmount;
        for (uint256 index = 0; index < _strategyList.length; index++) {
            uint256 liquidityShares = collateralShareInStrategy[creditLineHash][_strategyList[index]];
            if (liquidityShares > 0) {
                uint256 _tokenInStrategy = IYield(_strategyList[index]).getTokensForShares(liquidityShares, _asset);
                _activeAmount = _activeAmount.add(_tokenInStrategy);
                if(_activeAmount>_amountInTokens){
                    liquidityShares = liquidityShares.sub((_activeAmount.sub(_amountInTokens)).mul(liquidityShares).div(_tokenInStrategy));
                }
                collateralShareInStrategy[creditLineHash][_strategyList[index]] = collateralShareInStrategy[creditLineHash][_strategyList[index]].sub(liquidityShares);
                ISavingsAccount(IPoolFactory(PoolFactory).savingsAccount()).withdraw(msg.sender,liquidityShares, _asset, _strategyList[index], false);
                // TODO: is equality noot  sufficient here
                if(_activeAmount <= _amountInTokens){
                    return;
                }
            }
        }
        require(_activeAmount < _amountInTokens,"insufficient collateral");
    }


    function liquidation(bytes32 creditLineHash) 
        external payable
    {
        require(creditLineInfo[creditLineHash].currentStatus == creditLineStatus.ACTIVE,
                "CreditLine: Credit line should be active.");

        uint256 currentCollateralRatio = calculateCurrentCollateralRatio(creditLineHash);
        require(currentCollateralRatio < creditLineInfo[creditLineHash].liquidationThreshold,
                "CreditLine: Collateral ratio is higher than liquidation threshold");

        address _collateralAsset = creditLineInfo[creditLineHash].collateralAsset;
        address _lender = creditLineInfo[creditLineHash].lender;
        uint256 _totalCollateralToken = calculateTotalCollateralTokens(creditLineHash);
        address _borrowAsset = creditLineInfo[creditLineHash].borrowAsset;

        if(creditLineInfo[creditLineHash].autoLiquidation) { 

            if(_lender == msg.sender){
                transferFromSavingAccount(_collateralAsset, _totalCollateralToken, address(this), msg.sender);    
            }
            else{
                uint256 _ratioOfPrices =IPriceOracle(IPoolFactory(PoolFactory).priceOracle()).getLatestPrice(
                    _borrowAsset,
                    _collateralAsset);

                uint256 _borrowToken = (_totalCollateralToken.mul(_ratioOfPrices).div(10**8));
                // TODO: Isn't collateral inn savings account, how will this work
                IERC20(_borrowAsset).safeTransferFrom(msg.sender,_lender, _borrowToken);
                _withdrawCollateral(_collateralAsset, _totalCollateralToken,creditLineHash);   
            }
           
        }
        else {
            require(msg.sender == creditLineInfo[creditLineHash].lender,"CreditLine: Liquidation can only be performed by lender.");
            transferFromSavingAccount(_collateralAsset, _totalCollateralToken, address(this), msg.sender);
        }
        // TODO: Status will change to requested, so I guess default should be doesn't exists ?
        delete creditLineInfo[creditLineHash];
    }


    receive() external payable {
        require(
            msg.sender == IPoolFactory(PoolFactory).savingsAccount(),
            "CreditLine::receive invalid transaction"
        );
    }

    // Think about threshHold liquidation 
    // only one type of token is accepted check for that
    // collateral ratio has to calculated initially
    // current debt is more than borrow amount
}
