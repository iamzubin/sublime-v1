import "./TestUtils.sol";
import "./Scenarios.sol";


contract TwitterVerifierTest is TestUtils, Scenarios {

    function _getChainId() private view returns (uint256 chainId) {
        this; // silence state mutability warning without generating bytecode - see https://github.com/ethereum/solidity/issues/2691
        // solhint-disable-next-line no-inline-assembly
        assembly {
            chainId := chainid()
        }
    }

    function setUp() public {
        SetUpGlobalActors();
        // SetUpAllContracts();
        SetUpTwitterVerifierActors();
        setUpTwitterVerifierContracts();
    }

    function test_RegisterSelf( )public{
        emit log_address(address(twitterVerifier));
        verifier.registerSelf(address(twitterVerifier),true,"test","test", block.timestamp);
        (string memory twitterId,string memory tweetId) = twitterVerifier.userData(address(verifier));
        assert(keccak256(abi.encode(twitterId))==keccak256(abi.encode("test")));
    }

    
}