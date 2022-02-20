import "./TestUtils.sol";
import "./Scenarios.sol";


contract TwitterVerifierTest is TestUtils, Scenarios {
    function setUp() public {
        SetUpGlobalActors();
        // SetUpAllContracts();
        SetUpTwitterVerifierActors();
        setUpTwitterVerifierContracts();
    }
    // function test1(string memory _twitterId)public{
    function test1()public{
        verifier.registerSelf(address(twitterVerifier),true, "1", block.timestamp + 5000);
        // assert(ITwitterVerifier(address(twitterVerifier)).userData(address(verifier))==_twitterId );
        assert(keccak256(abi.encode((twitterVerifier.userData(address(verifier)))))==keccak256(abi.encode("1")));

    }
}