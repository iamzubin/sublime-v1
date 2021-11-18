// SPDX-License-Identifier: MIT
pragma solidity 0.7.6;

import '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';
import '../interfaces/IVerification.sol';
import '../interfaces/IVerifier.sol';

contract AdminVerifier is Initializable, IVerifier, OwnableUpgradeable {
    struct Lock {
        uint256 unlockTime;
        uint256 value;
    }

    bytes32 constant VERIFICATION_UPDATE_LOCK_SELECTOR = keccak256("VERIFICATION_UPDATE");

    /**
     * @notice stores the timestamp at which locks are complete
     **/
    mapping(bytes32 => Lock) public locks;

    /**
     * @notice stores the time in seconds for which timeLock takes effect when changing any variable
     * @dev timelocks are used when changing any sensitive variables by owner
     **/
    uint256 public timeLockDelay;

    /**
     * @notice stores the verification contract instance
     */
    IVerification public verification;

    /**
     * @notice stores the user metadata against their address
     */
    mapping(address => string) public userData;

    /**
     * @notice emitted when verification contract address is updated
     * @param verification address of the updated verification contract
     */
    event VerificationUpdated(address indexed verification);

    event VerificationUpdateRequested(address indexed verification, uint256 unlocksAt);

    event LockReset(bytes32 lockId);

    /// @notice Initializes the variables of the contract
    /// @dev Contract follows proxy pattern and this function is used to initialize the variables for the contract in the proxy
    /// @param _admin Admin of the verification contract who can add verifiers and remove masterAddresses deemed invalid
    function initialize(address _admin, address _verification) external initializer {
        super.__Ownable_init();
        super.transferOwnership(_admin);
        _updateVerification(_verification);
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

    function requestVerificationUpdate(address _verification) external onlyOwner {
        bytes32 _lockId = VERIFICATION_UPDATE_LOCK_SELECTOR;
        uint256 _unlocksAt = _setLock(_lockId, uint256(_verification));
        emit VerificationUpdateRequested(_verification, _unlocksAt);
    }

    /**
     * @notice used to update verification contract address
     * @dev ohly owner can update
     * @param _verification address of the verification contract
     */
    function updateVerification(address _verification) external onlyOwner {
        bytes32 _lockId = VERIFICATION_UPDATE_LOCK_SELECTOR;
        require(locks[_lockId].unlockTime <= block.timestamp, "Timelock still running");
        require(address(locks[_lockId].value) == _verification, "Param doesnt match request");
        delete locks[_lockId];
        _updateVerification(_verification);
    }

    function _updateVerification(address _verification) internal {
        verification = IVerification(_verification);
        emit VerificationUpdated(_verification);
    }
}
