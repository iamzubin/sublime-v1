
pragma solidity 0.7.6;

import '../interface/IHevm.sol';



contract TwitterWorker {

    Hevm hevm;


    function signmsg() public returns (uint8, bytes32, bytes32) {

        (uint8 v, bytes32 r, bytes32 s) = hevm.sign(30614993319191180046248218685843036791677982523294095135073921308664308674304,"0x68656c6c6f20776f726c64");
        return (v,r,s);
    }    
}