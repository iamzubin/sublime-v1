// SPDX-License-Identifier: MIT
pragma solidity 0.7.6;

import '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';
import '../interfaces/IVerification.sol';
import '../interfaces/IVerifier.sol';

contract TwitterVerifier is Initializable, IVerifier, OwnableUpgradeable {
    /**
     * @notice stores the verification contract instance
     */
    IVerification public verification;

    /**
     * @notice stores the user metadata against their address
     */
    mapping(address => string) public userData;
    /**
     * @notice mapping from userData to userAddress
     */
    mapping(string => address) public twitterIdMap;
    mapping(bytes32 => address) private hashAddressMap;
    address public signerAddress;

    /**
     * @notice emitted when verification contract address is updated
     * @param verification address of the updated verification contract
     */
    event VerificationUpdated(address indexed verification);
    /**
     * @notice emitted when Signer address is updated
     * @param signerAddress address of the updated verification contract
     */
    event SignerUpdated(address indexed signerAddress);

    /// @notice Initializes the variables of the contract
    /// @dev Contract follows proxy pattern and this function is used to initialize the variables for the contract in the proxy
    /// @param _admin Admin of the verification contract who can add verifiers and remove masterAddresses deemed invalid
    /// @param _verification Verification contract address
    /// @param _signerAddress Address of the signer bot who'll verify twitter account and sign messages off-chain
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
     * @dev only owner can register users
     * @param _v int v
     * @param _r part signed message hash
     * @param _s part signed message hash
     * @param _timestamp timestamp for the signed message
     * @param _userData metadata related to user :  here "twitterId/tweetId"
     * @param _isMasterLinked should master address be linked to itself
     */

    function registerSelf(
        bool _isMasterLinked,
        uint8 _v,
        bytes32 _r,
        bytes32 _s,
        string memory _userData,
        uint256 _timestamp
    ) external {
        require(bytes(userData[msg.sender]).length == 0, 'User already exists');
        require(twitterIdMap[_userData] == address(0), 'Signed message already used');
        require(block.timestamp < _timestamp + 86400, 'Signed transaction expired');
        bytes32 eip712DomainHash = keccak256(
            abi.encode(keccak256('EIP712Domain(string name,string version)'), keccak256(bytes('SublimeTwitter')), keccak256(bytes('1')))
        );

        bytes32 hashStruct = keccak256(
            abi.encode(
                keccak256('set(string twitterId,address userAddr,uint256 timestamp)'),
                keccak256(bytes(_userData)),
                msg.sender,
                _timestamp
            )
        );
        require(hashAddressMap[hashStruct] == address(0), 'Hash Already Used');

        bytes32 hash = keccak256(abi.encodePacked('\x19\x01', eip712DomainHash, hashStruct));
        address signer = ecrecover(hash, _v, _r, _s);
        require(signer == signerAddress, 'Invalid signature');

        verification.registerMasterAddress(msg.sender, _isMasterLinked);
        userData[msg.sender] = _userData;
        twitterIdMap[_userData] = msg.sender;
        emit UserRegistered(msg.sender, _isMasterLinked, _userData);
    }

    /**
     * @notice used to unregister user
     * @dev only owner can unregister users
     */
    function unregisterSelf() external {
        string memory _userdata = userData[msg.sender];
        require(bytes(_userdata).length != 0, 'User doesnt exists');
        delete twitterIdMap[_userdata];
        delete userData[msg.sender];
        verification.unregisterMasterAddress(msg.sender, address(this));
        emit UserUnregistered(msg.sender);
    }

    function unregisterUser(address _user) external onlyOwner {
        delete twitterIdMap[userData[_user]];
        delete userData[_user];
        verification.unregisterMasterAddress(_user, address(this));
        emit UserUnregistered(msg.sender);
    }

    /**
     * @notice used to update verification contract address
     * @dev only owner can update
     * @param _verification address of the verification contract
     */
    function updateVerification(address _verification) external onlyOwner {
        _updateVerification(_verification);
    }

    function _updateVerification(address _verification) internal {
        verification = IVerification(_verification);
        emit VerificationUpdated(_verification);
    }

    /**
     * @notice used to update signer address
     * @dev only owner can update
     * @param _signerAddress address of the verification contract
     */
    function updateSignerAddress(address _signerAddress) external onlyOwner {
        _updateSignerAddress(_signerAddress);
    }

    function _updateSignerAddress(address _signerAddress) internal {
        signerAddress = _signerAddress;
        emit SignerUpdated(signerAddress);
    }
}
