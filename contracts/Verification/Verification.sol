// SPDX-License-Identifier: MIT
pragma solidity 0.7.6;

import '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';
import '@openzeppelin/contracts/cryptography/ECDSA.sol';
import '../interfaces/IVerification.sol';

/// @title Contract that handles linking identity of user to address
///
contract Verification is Initializable, IVerification, OwnableUpgradeable {

    struct LinkedAddress {
        address masterAddress;
        uint256 activatesAt;
    }

    struct Lock {
        uint256 unlockTime;
        uint256 value;
    }

    bytes32 constant TIME_LOCK_DELAY_UPDATE_LOCK_SELECTOR = keccak256("TIME_LOCK_DELAY_UPDATE");
    bytes32 constant MASTER_ADDRESS_ACTIVATION_DELAY_UPDATE_LOCK_SELECTOR = keccak256("MASTER_ADDRESS_ACTIVATION_DELAY_UPDATE");
    bytes32 constant LINKED_ADDRESS_ACTIVATION_DELAY_UPDATE_LOCK_SELECTOR = keccak256("LINKED_ADDRESS_ACTIVATION_DELAY_UPDATE");

    /**
     * @notice stores the time in seconds for which timeLock takes effect when changing any variable
     * @dev timelocks are used when changing any sensitive variables by owner
     **/
    uint256 public timeLockDelay;

    /// @notice Delay in seconds after which master address is activated once registered 
    uint256 public masterAddressActivationDelay;

    /// @notice Delay in seconds after which linked address is activated once registered
    uint256 public linkedAddressActivationDelay;

    /**
     * @notice stores the timestamp at which locks are complete
     **/
    mapping(bytes32 => Lock) public locks;

    /// @notice Tells whether a given verifier is valid
    /// @dev Mapping that stores valid verifiers as added by admin. verifier -> true/false
    /// @return boolean that represents if the specified verifier is valid
    mapping(address => bool) public verifiers;

    /// @notice Maps masterAddress with the verifier that was used to verify it and the time when master address is active
    /// @dev Mapping is from masterAddress -> verifier -> activationTime
    /// @return Verifier used to verify the given master address
    mapping(address => mapping(address => uint256)) public masterAddresses;

    /// @notice Maps linkedAddresses with the master address and activation time
    /// @dev Mapping is linkedAddress -> (MasterAddress, activationTimestamp)
    /// @return Returns the master address and activation time for the linkedAddress
    mapping(address => LinkedAddress) public linkedAddresses;

    /** 
    @dev Message that has to be prefixed to the address when signing with master address so that specified address can be linked to it
    e.g. If 0xabc is to be linked to 0xfed, then 0xfed has to sign ${ChainId}${APPROVAL_MESSAGE}${expiryTime}0xabc with 0xfed's private key. This signed message has to be then submitted by 0xabc to linkAddress method
    */
    string constant APPROVAL_MESSAGE = 'APPROVING ADDRESS TO BE LINKED TO ME ON SUBLIME';

    /// @notice Prevents anyone other than a valid verifier from calling a function
    modifier onlyVerifier() {
        require(verifiers[msg.sender], 'Invalid verifier');
        _;
    }

    /// @notice Initializes the variables of the contract
    /// @dev Contract follows proxy pattern and this function is used to initialize the variables for the contract in the proxy
    /// @param _admin Admin of the verification contract who can add verifiers and remove masterAddresses deemed invalid
    function initialize(address _admin) external initializer {
        super.__Ownable_init();
        super.transferOwnership(_admin);
    }

    /// @notice owner can add new verifier
    /// @dev Verifier can add master address or remove addresses added by it
    /// @param _verifier Address of the verifier contract
    function addVerifier(address _verifier) external onlyOwner {
        require(_verifier != address(0), 'V:AV-Verifier cant be 0 address');
        require(!verifiers[_verifier], 'V:AV-Verifier exists');
        verifiers[_verifier] = true;
        emit VerifierAdded(_verifier);
    }

    /// @notice owner can remove exisiting verifier
    /// @dev Verifier can add master address or remove addresses added by it
    /// @param _verifier Address of the verifier contract
    function removeVerifier(address _verifier) external onlyOwner {
        require(verifiers[_verifier], 'V:AV-Verifier doesnt exist');
        delete verifiers[_verifier];
        emit VerifierRemoved(_verifier);
    }

    /// @notice Only verifier can add register master address
    /// @dev Multiple accounts can be linked to master address to act on behalf. Master address can be registered by multiple verifiers
    /// @param _masterAddress address which is registered as verified
    /// @param _isMasterLinked boolean which specifies if the masterAddress has to be added as a linked address
    function registerMasterAddress(address _masterAddress, bool _isMasterLinked) external override onlyVerifier {
        require(masterAddresses[_masterAddress][msg.sender] == 0, 'V:RMA-Already registered');
        uint256 _masterAddressActivatesAt = block.timestamp + masterAddressActivationDelay;
        masterAddresses[_masterAddress][msg.sender] = _masterAddressActivatesAt;
        emit UserRegistered(_masterAddress, msg.sender, _masterAddressActivatesAt);

        if (_isMasterLinked) {
            _linkAddress(_masterAddress, _masterAddress);
        }
    }

    /// @notice Master address can be unregistered by registered verifier or owner
    /// @dev unregistering master address doesn't affect linked addreses mapping to master address, though they would not be verified by this verifier anymore
    /// @param _masterAddress address which is being unregistered
    /// @param _verifier verifier address from which master address is unregistered
    function unregisterMasterAddress(address _masterAddress, address _verifier) external override {
        if (msg.sender != super.owner()) {
            require(masterAddresses[_masterAddress][msg.sender] != 0 || msg.sender == _verifier, 'V:UMA-Invalid verifier');
        }
        delete masterAddresses[_masterAddress][_verifier];
        emit UserUnregistered(_masterAddress, _verifier, msg.sender);
    }

    function _linkAddress(address _linked, address _master) internal {
        uint256 _linkedAddressActivatesAt = block.timestamp + linkedAddressActivationDelay;
        linkedAddresses[_linked] = LinkedAddress(_master, _linkedAddressActivatesAt);
        emit AddressLinked(_linked, _master, _linkedAddressActivatesAt);
    }

    /// @notice Link an address with a master address
    /// @dev Master address to which the address is being linked need not be verified
    /// @param _approval Signature made by the master address to link the address
    function linkAddress(bytes memory _approval) external {
        require(linkedAddresses[msg.sender].masterAddress == address(0), 'V:LA-Address already linked');
        bytes memory _messageToSign = abi.encodePacked(APPROVAL_MESSAGE, msg.sender);
        bytes32 _hashedMessage = keccak256(_messageToSign);
        address _master = ECDSA.recover(_hashedMessage, _approval);
        _linkAddress(msg.sender, _master);
    }

    /// @notice Unlink address with master address
    /// @dev a single address can be linked to only one master address
    /// @param _linkedAddress Address that is being unlinked
    function unlinkAddress(address _linkedAddress) external {
        address _linkedTo = linkedAddresses[_linkedAddress].masterAddress;
        require(_linkedTo != address(0), 'V:UA-Address not linked');
        require(_linkedTo == msg.sender, 'V:UA-Not linked to sender');
        delete linkedAddresses[_linkedAddress];
        emit AddressUnlinked(_linkedAddress, _linkedTo);
    }

    /// @notice User to verify if an address is linked to a master address that is registered with verifier
    /// @dev view function
    /// @param _user address which has to be checked if mapped against a verified master address
    /// @param _verifier verifier with which master address has to be verified
    /// @return if the user is linke dto a registered master address
    function isUser(address _user, address _verifier) external view override returns (bool) {
        LinkedAddress memory _linkedAddress = linkedAddresses[_user];
        uint256 _masterActivatesAt = masterAddresses[_linkedAddress.masterAddress][_verifier];
        if (
            _linkedAddress.masterAddress == address(0) || 
            _linkedAddress.activatesAt > block.timestamp ||
            _masterActivatesAt == 0 ||
            _masterActivatesAt > block.timestamp
        ) {
            return false;
        }
        return true;
    }

    function _setLock(bytes32 _lockId, uint256 _value) internal returns(uint256) {
        require(locks[_lockId].unlockTime == 0, "request already exists");
        uint256 _unlocksAt = block.timestamp + timeLockDelay;
        locks[_lockId] = Lock(_unlocksAt, _value);
        return _unlocksAt;
    }
    
    function resetLock(bytes32 _lockId) external onlyOwner {
        require(locks[_lockId].unlockTime != 0, "Nothing to reset");
        emit LockReset(_lockId);
        delete locks[_lockId];
    }

    function requestTimeLockDelayUpdate(uint256 _timeLockDelay) external onlyOwner {
        bytes32 _lockId = TIME_LOCK_DELAY_UPDATE_LOCK_SELECTOR;
        uint256 _unlocksAt = _setLock(_lockId, _timeLockDelay);
        emit TimeLockDelayUpdateRequested(_timeLockDelay, _unlocksAt);
    }

    function updateTimeLockDelay(uint256 _timeLockDelay) external onlyOwner {
        bytes32 _lockId = TIME_LOCK_DELAY_UPDATE_LOCK_SELECTOR;
        require(locks[_lockId].unlockTime <= block.timestamp, "Timelock still running");
        require(locks[_lockId].value == _timeLockDelay, "Param doesnt match request");
        delete locks[_lockId];
        _updateTimeLockDelay(_timeLockDelay);
    }

    function _updateTimeLockDelay(uint256 _timeLockDelay) internal {
        timeLockDelay = _timeLockDelay;
        emit TimeLockDelayUpdated(_timeLockDelay);
    }

    function requestMasterAddressActivationDelayUpdate(uint256 _masterAddressActivationDelay) external onlyOwner {
        bytes32 _lockId = MASTER_ADDRESS_ACTIVATION_DELAY_UPDATE_LOCK_SELECTOR;
        uint256 _unlocksAt = _setLock(_lockId, _masterAddressActivationDelay);
        emit MasterAddressActivationDelayRequested(_masterAddressActivationDelay, _unlocksAt);
    }

    function updateMasterAddressActivationDelay(uint256 _masterAddressActivationDelay) external onlyOwner {
        bytes32 _lockId = MASTER_ADDRESS_ACTIVATION_DELAY_UPDATE_LOCK_SELECTOR;
        require(locks[_lockId].unlockTime <= block.timestamp, "Timelock still running");
        require(locks[_lockId].value == _masterAddressActivationDelay, "Param doesnt match request");
        delete locks[_lockId];
        _updateMasterAddressActivationDelay(_masterAddressActivationDelay);
    }

    function _updateMasterAddressActivationDelay(uint256 _masterAddressActivationDelay) internal {
        masterAddressActivationDelay = _masterAddressActivationDelay;
        emit MasterAddressActivationDelayUpdated(_masterAddressActivationDelay);
    }

    function requestLinkedAddressActivationDelayUpdate(uint256 _linkedAddressActivationDelay) external onlyOwner {
        bytes32 _lockId = LINKED_ADDRESS_ACTIVATION_DELAY_UPDATE_LOCK_SELECTOR;
        uint256 _unlocksAt = _setLock(_lockId, _linkedAddressActivationDelay);
        emit LinkedAddressActivationDelayRequested(_linkedAddressActivationDelay, _unlocksAt);
    }

    function updateLinkedAddressActivationDelay(uint256 _linkedAddressActivationDelay) external onlyOwner {
        bytes32 _lockId = LINKED_ADDRESS_ACTIVATION_DELAY_UPDATE_LOCK_SELECTOR;
        require(locks[_lockId].unlockTime <= block.timestamp, "Timelock still running");
        require(locks[_lockId].value == _linkedAddressActivationDelay, "Param doesnt match request");
        delete locks[_lockId];
        _updateLinkedAddressActivationDelay(_linkedAddressActivationDelay);
    }

    function _updateLinkedAddressActivationDelay(uint256 _linkedAddressActivationDelay) internal {
        linkedAddressActivationDelay = _linkedAddressActivationDelay;
        emit LinkedAddressActivationDelayUpdated(_linkedAddressActivationDelay);
    }
}
