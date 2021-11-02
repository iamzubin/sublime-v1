// SPDX-License-Identifier: MIT
pragma solidity 0.7.0;

import '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';
import '../interfaces/IVerification.sol';
import '../interfaces/IVerifier.sol';

contract AdminVerifier is Initializable, IVerifier, OwnableUpgradeable {
    IVerification public verification;

    mapping(address => string) public userData;

    event VerificationUpdated(address indexed verification);

    /// @notice Initializes the variables of the contract
    /// @dev Contract follows proxy pattern and this function is used to initialize the variables for the contract in the proxy
    /// @param _admin Admin of the verification contract who can add verifiers and remove masterAddresses deemed invalid
    function initialize(address _admin, address _verification) external initializer {
        super.__Ownable_init();
        super.transferOwnership(_admin);
        _updateVerification(_verification);
    }

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

    function unregisterUser(address _user) external onlyOwner {
        require(bytes(userData[_user]).length != 0, 'User doesnt exists');
        delete userData[_user];
        verification.unregisterMasterAddress(_user, address(this));
        emit UserUnregistered(_user);
    }

    function updateVerification(address _verification) external onlyOwner {
        _updateVerification(_verification);
    }

    function _updateVerification(address _verification) internal onlyOwner {
        verification = IVerification(_verification);
        emit VerificationUpdated(_verification);
    }
}
