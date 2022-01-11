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
    mapping(address => string) public metadata;

    /// @notice Initializes the variables of the contract
    /// @dev Contract follows proxy pattern and this function is used to initialize the variables for the contract in the proxy
    /// @param _signer Address which can provide signed tickets to register users
    /// @param _verification Address of the verification contract where all the verified users are stored
    function initialize(address _signer, address _verification) external initializer {
        super.__Ownable_init();
        super.transferOwnership(_admin);
        verification = IVerification(_verification);
    }

    /**
     * @notice used to register user
     * @dev Any user can register themselves
     * @param _metadata metadata related to the user
     * @param _expiresAt
     * @param _approval
     * @param _isMasterLinked should master address be linked to itself
     */
    function registerUser(
        string memory _metadata,
        uint256 _expiresAt,
        bytes _approval,
        bool _isMasterLinked
    ) external {
        require(bytes(metadata[_user]).length == 0, 'User already exists');

        verification.registerMasterAddress(_user, _isMasterLinked);
        userData[_user] = _metadata;
        emit UserRegistered(_user, _isMasterLinked, _metadata);
    }

    /**
     * @notice used to unregister user
     * @dev ohly owner can unregister users
     * @param _user address of the user being unregistered
     */
    function unregisterUser(address _user) external {
        require(bytes(userData[_user]).length != 0, 'User doesnt exists');
        delete userData[_user];
        verification.unregisterMasterAddress(_user, address(this));
        emit UserUnregistered(_user);
    }
}
