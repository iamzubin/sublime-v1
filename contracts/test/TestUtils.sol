pragma solidity 0.7.6;

import '@openzeppelin/contracts/token/ERC20/SafeERC20.sol';
import '@openzeppelin/contracts/math/SafeMath.sol';
import '@openzeppelin/contracts/utils/ReentrancyGuard.sol';
import '@openzeppelin/contracts-upgradeable/proxy/Initializable.sol';
import '@openzeppelin/contracts-upgradeable/token/ERC20/ERC20PausableUpgradeable.sol';


import "../CreditLine/CreditLine.sol";
import "../PriceOracle.sol";
import "../SavingsAccount/SavingsAccount.sol";
import "../yield/StrategyRegistry.sol";
import "../yield/NoYield.sol";

import "./DeployUtils.sol";
import "./Constants.sol";
import "./ProtocolFeeCollector.sol";

import "../Verification/Verification.sol";
import "../Verification/twitterVerifier.sol";

import "../Pool/Extension.sol";
import "../Pool/Repayments.sol";
import "../Pool/PoolFactory.sol";
import "../Pool/Pool.sol";

import "../SavingsAccount/SavingsAccount.sol";
import "../SavingsAccount/SavingsAccountUtil.sol";

import "../CreditLine/CreditLine.sol";

import "../yield/AaveYield.sol";
import "../yield/CompoundYield.sol";
import "../yield/NoYield.sol";
import "../yield/YearnYield.sol";
import "../yield/StrategyRegistry.sol";

import "../PriceOracle.sol";
import "./ActorsUtils.sol";

// interface Hevm {
//     function warp(uint256) external;
//     function store(address,bytes32,bytes32) external;
// }
// interface Hevm {
//     function sign(uint, bytes32 ) public returns (uint8, bytes32, bytes32 );
// }


// interface Hevm {
//     function warp(uint256) external;
//     function store(address,bytes32,bytes32) external;
//     function sign(uint, bytes32 ) public returns (uint8, bytes32, bytes32 );
// }

contract TestUtils is DSTest, ActorsUtils, Constants {
    using SafeERC20 for IERC20;
    using SafeMath for uint256;

    //Hevm hevm;

    mapping (address => uint256) balanceSlot;

    PriceOracle priceOracle;
    StrategyRegistry strategyRegistry;
    CreditLine creditLine;
    SavingsAccount savingsAccount;
    Repayments repayments;
    Extension extensions;
    Verification verification;
    PoolFactory poolFactory;
    TwitterVerifier twitterVerifier;

    CompoundYield compoundYield;
    AaveYield aaveYield;
    YearnYield yearnYield;
    NoYield noYield;
    ProtocolFeeCollector protocolFeeCollector;

    // Hevm hevm;
    Hevm hevm = Hevm(0x7109709ECfa91a80626fF3989D68f67F5b1DD12D);

    // constructor() public { hevm = Hevm(address(bytes20(uint160(uint256(keccak256("hevm cheat code")))))); }

    function mint(address token, address account, uint256 amt) public {
        //address addr = token;
        uint256 slot  = balanceSlot[token];
        uint256 bal = IERC20(token).balanceOf(account);

        hevm.store(
            token,
            keccak256(abi.encode(account, slot)), // Mint tokens
            bytes32(bal + amt)
        );

        assertEq(IERC20(token).balanceOf(account), bal + amt); // Assert new balance
    }

    function restrictToRange(uint256 val, uint256 min, uint256 max) public pure returns (uint256) {
        return restrictToRange(val, min, max, false);
    }

    function restrictToRange(uint256 val, uint256 min, uint256 max, bool nonZero) public pure returns (uint256) {
        if      (val == 0 && !nonZero) return 0;
        else if (max == min)           return max;
        else                           return val % (max - min) + min;
    }

    function deployPriceOracle() public {
        priceOracle = new PriceOracle();
        priceOracle.initialize(address(admin));
    }

    function deployStrategyRegistry() public {
        strategyRegistry = new StrategyRegistry();
        strategyRegistry.initialize(address(admin), 5); //initializing with 5 max. strategies
    }

    function deploySavingsAccount() public {
        savingsAccount = new SavingsAccount();
        savingsAccount.initialize(address(admin), address(strategyRegistry), address(creditLine));
    }

    function deployNoYield() public {
        noYield = new NoYield();
        noYield.initialize(address(admin), payable(address(savingsAccount)));
    }

    function deployCompoundYield() public {
        compoundYield = new CompoundYield(WETH);
        compoundYield.initialize(address(admin), payable(address(savingsAccount)));
    }

    function deployAaveYield() public {
        aaveYield = new AaveYield(WETH);
        aaveYield.initialize(address(admin), payable(address(savingsAccount)), wethGateway, 
                                aaveProtocolDataProvider, aaveLendingPoolAddressesProvider);
    }

    function deployYearnYield() public {
        yearnYield = new YearnYield(WETH);
        yearnYield.initialize(address(admin), payable(address(savingsAccount)));
    }

    // need to convert this to Solc 
    //export function getPoolInitSigHash(): BytesLike {
    //const _interface = new ethers.utils.Interface(poolContractMeta.abi);
    //const poolInitializeSigHash = _interface.getSighash('initialize');
    //return poolInitializeSigHash;
    //}

    function deployProtocolFeeCollector() public {
        protocolFeeCollector = new ProtocolFeeCollector();
        protocolFeeCollector.initialize(address(admin));
    }

    function deployCreditLines() public {
        creditLine = new CreditLine();
        creditLine.initialize(
        address(admin), //default strategy NEEDS TO CHANGE
        address(priceOracle),//address _priceOracle,
        address(savingsAccount),//address _savingsAccount,
        address(strategyRegistry),//address _strategyRegistry,
        address(admin),//address _owner,
        1e28,//uint256 _protocolFeeFraction,
        address(protocolFeeCollector),//address _protocolFeeCollector,
        1e28//uint256 _liquidatorRewardFraction    
        );
    }

    //function deployPoolFactory(uint256 collectionPeriod, uint256 loanWithdrawalDuration,
    //                            uint256 marginCallDuration, ) public {
    //    poolFactory = new PoolFactory();
    //    poolFactory.initialize(
    //        address(admin),
    //        5_000_000, //collectionPeriod,
    //        15_000_000, //loanWithdrawalDuration,
    //        300, //marginCallDuration,
    //        //poolInitFuncSelector,
    //        15 * 1e28, //_liquidatorRewardFraction, 0.15
    //        10 * 1e28, //_poolCancelPenaltyMultiple, 0.1
    //        10 * 1e28, //_minBorrowFraction 0.1
    //        1e26, //_protocolFeeFraction
    //        address(protocolFeeCollector), //_protocolFeeCollector
    //        address(noYield) //_noStrategy
    //   )
    //}

    function deployRepayments() public {
        repayments = new Repayments();
        repayments.initialize(address(poolFactory), //_poolFactory
                                1e29, // _gracePenaltyRate
                                1e29); // _gracePeriodFraction
    }

    function deployExtensions() public {
        extensions = new Extension();
        extensions.initialize(address(poolFactory),
                                50 * 1e28); // voting pass ratio
    }

    function deployVerification() public {
        verification = new Verification();
        verification.initialize(address(admin), verificationActivationDelay);
    }

    function deployTwitterVerifier() public {
        twitterVerifier = new TwitterVerifier();
        twitterVerifier.initialize(address(admin), address(verification), hevm.addr(4));
    }
    function deployAdminVerifier() public {
        adminVerifier = new AdminVerifier();
        adminVerifier.initialize(address(admin), address(verification), address(admin));
    }

    function SetUpCreditLines() public {
        //address adminAddress = address(admin);

        deployPriceOracle();
        deployStrategyRegistry();
        deployProtocolFeeCollector();

        admin.addStrategy(address(strategyRegistry), address(admin)); // CHANGE DEFAULT ADDRESS FROM ADMIN TO SOMETHING ELSE

        deployCreditLines();
        deploySavingsAccount();
        deployNoYield();
        deployCompoundYield();
        deployVerification();
        deployTwitterVerifier();

        admin.updateSavingsAccount(address(creditLine), address(savingsAccount));

        admin.updateStrategy(address(strategyRegistry), 0, address(admin), address(noYield));
        admin.addStrategy(address(strategyRegistry), address(compoundYield));

        admin.updateDefaultStrategy(address(creditLine), address(noYield));
        admin.setUpAllOracles(address(priceOracle));

        balanceSlot[USDC] = 9;
        balanceSlot[DAI] = 2;
        balanceSlot[WETH] = 3;
        balanceSlot[WBTC] = 0;

        admin.updateBorrowLimitLimits(address(creditLine), 1, 1e39);
        admin.updateIdealCollateralRatioLimits(address(creditLine), 0, 5*1e30);
        admin.updateBorrowRateLimits(address(creditLine), 0, 1e30);
    }

    function SetUpAllContracts() public {
        //address adminAddress = address(admin);

        deployPriceOracle();
        deployStrategyRegistry();
        deployProtocolFeeCollector();
        deployCreditLines();
        deploySavingsAccount();
        deployNoYield();
        deployCompoundYield();
        deployVerification();
        deployTwitterVerifier();
        //deployPoolFactory();
        deployRepayments();
        deployExtensions();
    }
    function setUpTwitterVerifierContracts() public {
        deployVerification();
        deployTwitterVerifier();
        admin.UpdateVerificationVerifier(address(verification),address(twitterVerifier));
        // verification.addVerifier(address(twitterVerifier));
        
    }
}