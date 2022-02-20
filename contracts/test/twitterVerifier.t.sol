import "./TestUtils.sol";
import "./Scenarios.sol";


contract TwitterVerifierTest is TestUtils, Scenarios {
    function setUp() public {
        SetUpGlobalActors();
        // SetUpAllContracts();
        // SetUpTwitterVerifierActors();
    }
    function test1()public{
        uint8 _v; 
        bytes32 _r;
        bytes32 _s;
        (uint8 v, bytes32 r, bytes32 s) = verifier.registerSelf(true, "1234", block.timestamp + 5000);
        (_v, _r, _s) = verifier.registerSelf(true, "1234", block.timestamp + 5000);
        assert(r==_r);
        assert(v==_v);
        assert(s==_s);
    }
}