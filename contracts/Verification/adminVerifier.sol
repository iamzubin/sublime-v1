// SPDX-License-Identifier: MIT
pragma solidity 0.7.6;

import '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';
import '../interfaces/IVerification.sol';
import '../interfaces/IVerifier.sol';

contract AdminVerifier is Initializable, IVerifier, OwnableUpgradeable {
    /**
     * @notice stores the verification contract instance
     */
    IVerification public verification;

    /**
     * @notice stores the user metadata against their address
     */
    mapping(address => string) public userData;
    address public signerAddress;

    /**
     * @notice emitted when verification contract address is updated
     * @param verification address of the updated verification contract
     */
    event VerificationUpdated(address indexed verification);
    event SignerUpdated(address indexed signerAddress);

    /// @notice Initializes the variables of the contract
    /// @dev Contract follows proxy pattern and this function is used to initialize the variables for the contract in the proxy
    /// @param _admin Admin of the verification contract who can add verifiers and remove masterAddresses deemed invalid
    function initialize(
        address _admin,
        address _verification,
        address _signerAddress
    ) external initializer {
        super.__Ownable_init();
        super.transferOwnership(_admin);
        _updateVerification(_verification);
        _updateSignerAddress(_signerAddress);
    }

    /**
     * @notice used to register user
     * @dev ohly owner can register users
     * @param _v int v
     * @param _r part signed message hash
     * @param _s part signed message hash
     * @param _deadline deadline for the signed message
     * @param _twitterId metadata related to the user
     * @param _isMasterLinked should master address be linked to itself
     */

    function registerSelf(
        bool _isMasterLinked,
        uint8 _v,
        bytes32 _r,
        bytes32 _s,
        string memory _twitterId,
        uint256 _deadline
    ) external {
        require(bytes(userData[msg.sender]).length == 0, 'User already exists');
        require(block.timestamp < _deadline, 'Signed transaction expired');
        bytes32 eip712DomainHash = keccak256(
            abi.encode(keccak256('EIP712Domain(string name,string version)'), keccak256(bytes('SublimeTwitter')), keccak256(bytes('1')))
        );

        bytes32 hashStruct = keccak256(
            abi.encode(
                keccak256('set(string twitterId,address userAddr,uint256 deadline)'),
                keccak256(bytes(_twitterId)),
                msg.sender,
                _deadline
            )
        );

        bytes32 hash = keccak256(abi.encodePacked('\x19\x01', eip712DomainHash, hashStruct));
        address signer = ecrecover(hash, _v, _r, _s);
        require(signer == signerAddress, 'MyFunction: invalid signature');

        verification.registerMasterAddress(msg.sender, _isMasterLinked);
        userData[msg.sender] = _twitterId;
        emit UserRegistered(msg.sender, _isMasterLinked, _twitterId);
    }

    /**
     * @notice used to unregister user
     * @dev ohly owner can unregister users
     */
    function unregisterSelf() external {
        require(bytes(userData[msg.sender]).length != 0, 'User doesnt exists');
        delete userData[msg.sender];
        verification.unregisterMasterAddress(msg.sender, address(this));
        emit UserUnregistered(msg.sender);
    }

    /**
     * @notice used to register user
     * @dev ohly owner can register users
     * @param _user address of the user being registered
     * @param _metadata metadata related to the user
     * @param _isMasterLinked should master address be linked to itself
     */
    function registerUser(
        address _user,
        string memory _metadata,
        bool _isMasterLinked
    ) external onlyOwner {
        require(bytes(userData[_user]).length == 0, 'User already exists');
        verification.registerMasterAddress(_user, _isMasterLinked);
        userData[_user] = _metadata;
        emit UserRegistered(_user, _isMasterLinked, _metadata);
    }

    /**
     * @notice used to unregister user
     * @dev ohly owner can unregister users
     * @param _user address of the user being unregistered
     */
    function unregisterUser(address _user) external onlyOwner {
        require(bytes(userData[_user]).length != 0, 'User doesnt exists');
        delete userData[_user];
        verification.unregisterMasterAddress(_user, address(this));
        emit UserUnregistered(_user);
    }
    
    /**
     * @notice used to update verification contract address
     * @dev ohly owner can update
     * @param _verification address of the verification contract
     */
    function updateVerification(address _verification) external onlyOwner {
        _updateVerification(_verification);
    }

    function _updateVerification(address _verification) internal {
        verification = IVerification(_verification);
        emit VerificationUpdated(_verification);
    }

    function updateSignerAddress(address _signerAddress) external onlyOwner {
        _updateSignerAddress(_signerAddress);
    }

    function _updateSignerAddress(address _signerAddress) internal {
        signerAddress = _signerAddress;
        emit SignerUpdated(signerAddress);
    }
}
