// SPDX-License-Identifier: MIT
pragma solidity 0.7.0;

import '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';
import '../interfaces/IVerification.sol';

contract adminVerifier is Initializable, OwnableUpgradeable {
    IVerification public verification;

    mapping(address => string) userData;

    event UserRegistered(address user, bool isMasterLinked, string metadata);
    event UserUnregistered(address user);

    /// @notice Initializes the variables of the contract
    /// @dev Contract follows proxy pattern and this function is used to initialize the variables for the contract in the proxy
    /// @param _admin Admin of the verification contract who can add verifiers and remove masterAddresses deemed invalid
    function initialize(address _admin, address _verification) public initializer {
        super.__Ownable_init();
        super.transferOwnership(_admin);
        verification = IVerification(_verification);
    }

    function registerUser(
        address _user,
        string memory _metadata,
        bool _isMasterLinked
    ) external onlyOwner {
        require(bytes(userData[_user]).length == 0, 'User already exists');
        verification.registerMasterAddress(_user, _isMasterLinked);
        emit UserRegistered(_user, _isMasterLinked, _metadata);
    }

    function unregisterUser(address _user) external onlyOwner {
        require(bytes(userData[_user]).length != 0, 'User doesnt exists');
        delete userData[_user];
        verification.unregisterMasterAddress(_user, address(this));
        emit UserUnregistered(_user);
    }
}
