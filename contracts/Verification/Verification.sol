// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

import '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';
import '@openzeppelin/contracts/cryptography/ECDSA.sol';
import '../interfaces/IVerification.sol';

/// @title Contract that handles linking identity of user to address
///
contract Verification is Initializable, IVerification, OwnableUpgradeable {
    /// @notice Tells whether a given verifier is valid
    /// @dev Mapping that stores valid verifiers as added by admin. verifier -> true/false
    /// @return boolean that represents if the specified verifier is valid
    mapping(address => bool) public verifiers;

    /// @notice Maps masterAddress with the verifier that was used to verify it
    /// @dev Mapping is from masterAddress -> verifier -> bool(isVerified)
    /// @return Verifier used to verify the given master address
    mapping(address => mapping(address => bool)) public masterAddresses;

    /// @notice Maps linkedAddresses with the master address
    /// @dev Mapping is linkedAddress -> MasterAddress
    /// @return Returns the master address for the linkedAddress
    mapping(address => address) public linkedAddresses;

    /** 
    @dev Message that has to be prefixed to the address when signing with master address so that specified address can be linked to it
    e.g. If 0xabc is to be linked to 0xfed, then 0xfed has to sign ${APPROVAL_MESSAGE}0xabc with 0xfed's private key. This signed message has to be then submitted by 0xabc to linkAddress method
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
        require(!masterAddresses[_masterAddress][msg.sender], 'V:RMA-Already registered');
        masterAddresses[_masterAddress][msg.sender] = true;
        if (_isMasterLinked) {
            linkedAddresses[_masterAddress] = _masterAddress;
        }
        emit UserRegistered(_masterAddress, msg.sender, _isMasterLinked);
    }

    /// @notice Master address can be unregistered by registered verifier or owner
    /// @dev unregistering master address doesn't affect linked addreses mapping to master address, though they would not be verified by this verifier anymore
    /// @param _masterAddress address which is being unregistered
    /// @param _verifier verifier address from which master address is unregistered
    function unregisterMasterAddress(address _masterAddress, address _verifier) external override {
        if (msg.sender != super.owner()) {
            require(masterAddresses[_masterAddress][msg.sender] || msg.sender == _verifier, 'V:UMA-Invalid verifier');
        }
        delete masterAddresses[_masterAddress][_verifier];
        emit UserUnregistered(_masterAddress, _verifier, msg.sender);
    }

    /// @notice Link an address with a master address
    /// @dev Master address to which the address is being linked need not be verified
    /// @param _approval Signature made by the master address to link the address
    function linkAddress(bytes memory _approval) external {
        require(linkedAddresses[msg.sender] == address(0), 'V:LA-Address already linked');
        bytes memory _messageToSign = abi.encodePacked(APPROVAL_MESSAGE, msg.sender);
        bytes32 _hashedMessage = keccak256(_messageToSign);
        address _signer = ECDSA.recover(_hashedMessage, _approval);
        linkedAddresses[msg.sender] = _signer;
        emit AddressLinked(msg.sender, _signer);
    }

    /// @notice Unlink address with master address
    /// @dev a single address can be linked to only one master address
    /// @param _linkedAddress Address that is being unlinked
    function unlinkAddress(address _linkedAddress) external {
        address _linkedTo = linkedAddresses[_linkedAddress];
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
        address _masterAddress = linkedAddresses[_user];
        if (_masterAddress == address(0) || !masterAddresses[_masterAddress][_verifier]) {
            return false;
        }
        return true;
    }
}
