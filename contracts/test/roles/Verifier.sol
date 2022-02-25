pragma solidity 0.7.6;

import "../interface/IHevm.sol";
import "../../interfaces/ITwitterVerifier.sol";
import "../Constants.sol";

contract Verifier {

    Hevm hevm = Hevm(0x7109709ECfa91a80626fF3989D68f67F5b1DD12D);

    function _getChainId() private view returns (uint256 chainId) {
        this; // silence state mutability warning without generating bytecode - see https://github.com/ethereum/solidity/issues/2691
        // solhint-disable-next-line no-inline-assembly
        assembly {
            chainId := chainid()
        }
    }
    function registerSelf(
        address _contractAddress,
        bool _isMasterLinked,
        string memory _twitterId,
        uint256 _deadline
        ) public {

        bytes32 hashStruct = keccak256(
            abi.encode(
                keccak256('set(string twitterId,string tweetId,address userAddr,uint256 timestamp)'),
                keccak256(bytes(_twitterId)),
                keccak256(bytes(_twitterId)),
                msg.sender,
                _deadline
            )
        );

        bytes32 domainSeparator = keccak256(abi.encode(
            keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
            keccak256(bytes("test")),
            keccak256(bytes("test")),
            _getChainId(),
            _contractAddress
        ));

        bytes32 hash = keccak256(abi.encodePacked("\x19\x01", domainSeparator, hashStruct));

        (uint8 v, bytes32 r, bytes32 s) = hevm.sign(999,hash);
        ITwitterVerifier(address(_contractAddress)).registerSelf(
        true,
        v,
        r,
        s,
        _twitterId,
        _twitterId,
        _deadline);
    }

    function unresigterSelf(address _contractAddress)public {
        ITwitterVerifier(address(_contractAddress)).unregisterSelf();
    }
}