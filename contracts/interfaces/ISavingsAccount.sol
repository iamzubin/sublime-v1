// SPDX-License-Identifier: MIT
pragma solidity 0.7.0;

interface ISavingsAccount {
    //events
    event Deposited(address indexed user, uint256 amount, address indexed token, address indexed strategy);
    event StrategySwitched(address indexed user, address indexed token, address currentStrategy, address indexed newStrategy);
    event Withdrawn(address indexed from, address indexed to, uint256 amountReceived, address indexed token, address strategy);
    event WithdrawnAll(address indexed user, uint256 tokenReceived, address indexed token);
    event Approved(address indexed token, address indexed from, address indexed to, uint256 amount);
    event Transfer(address indexed token, address strategy, address indexed from, address indexed to, uint256 amount);
    event CreditLineUpdated(address indexed _updatedCreditLine);
    event StrategyRegistryUpdated(address indexed _updatedStrategyRegistry);

    event CreditLineAllowanceRefreshed(address indexed token, address indexed from, uint256 amount);

    function deposit(
        uint256 amount,
        address token,
        address strategy,
        address to
    ) external payable returns (uint256 sharesReceived);

    /**
     * @dev Used to switch saving strategy of an token
     * @param currentStrategy initial strategy of token
     * @param newStrategy new strategy to invest
     * @param token address of the token
     * @param amount amount of **liquidity shares** to be reinvested
     */
    function switchStrategy(
        uint256 amount,
        address token,
        address currentStrategy,
        address newStrategy
    ) external;

    /**
     * @dev Used to withdraw token from Saving Account
     * @param withdrawTo address to which token should be sent
     * @param amount amount of liquidity shares to withdraw
     * @param token address of the token to be withdrawn
     * @param strategy strategy from where token has to withdrawn(ex:- compound,Aave etc)
     * @param withdrawShares boolean indicating to withdraw in liquidity share or underlying token
     */
    function withdraw(
        uint256 amount,
        address token,
        address strategy,
        address payable withdrawTo,
        bool withdrawShares
    ) external returns (uint256);

    function withdrawAll(address _token) external returns (uint256 tokenReceived);

    function approve(
        uint256 amount,
        address token,
        address to
    ) external;

    function increaseAllowance(
        uint256 amount,
        address token,
        address to
    ) external;

    function decreaseAllowance(
        uint256 amount,
        address token,
        address to
    ) external;

    function transfer(
        uint256 amount,
        address token,
        address poolSavingsStrategy,
        address to
    ) external returns (uint256);

    function transferFrom(
        uint256 amount,
        address token,
        address poolSavingsStrategy,
        address from,
        address to
    ) external returns (uint256);

    function balanceInShares(
        address user,
        address token,
        address strategy
    ) external view returns (uint256);

    function increaseAllowanceToCreditLine(
        uint256 amount,
        address token,
        address from
    ) external;

    function withdrawFrom(
        uint256 amount,
        address token,
        address strategy,
        address from,
        address payable to,
        bool withdrawShares
    ) external returns (uint256 amountReceived);

    function getTotalTokens(address _user, address _token) external returns (uint256 _totalTokens);
}
