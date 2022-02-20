pragma solidity 0.7.6;

import '../interface/IHevm.sol';
import '../../interfaces/ITwitterVerifier.sol';
import "../Constants.sol";

contract Verifier {

    Hevm hevm = Hevm(0x7109709ECfa91a80626fF3989D68f67F5b1DD12D);


    function registerSelf(
        address _contractAddress,
        bool _isMasterLinked,
        string memory _twitterId,
        uint256 _deadline
        ) public returns (uint8, bytes32, bytes32) {


        bytes32 eip712DomainHash = keccak256(
            abi.encode(keccak256('EIP712Domain(string name,string version)'), keccak256(bytes('SublimeTwitter')), keccak256(bytes('1')))
        );
        bytes32 hashStruct = keccak256(
            abi.encode(
                keccak256('set(string twitterId,address userAddr,uint256 deadline)'),
                keccak256(bytes("1")),
                address(this),
                _deadline
            )
        );
        bytes32 hash = keccak256(abi.encodePacked('\x19\x01', eip712DomainHash, hashStruct));
        (uint8 v, bytes32 r, bytes32 s) = hevm.sign(4,hash);

        ITwitterVerifier(address(_contractAddress)).registerSelf(true,
        v,
        r,
        s,
        "1" ,
        _deadline);

        return (v,r,s);
    }
}