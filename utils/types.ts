import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { AaveYield } from '@typechain/AaveYield';
import { CompoundYield } from '@typechain/CompoundYield';
import { SavingsAccount } from '@typechain/SavingsAccount';
import { StrategyRegistry } from '@typechain/StrategyRegistry';
import { YearnYield } from '@typechain/YearnYield';
import { Address } from 'hardhat-deploy/dist/types';
import { Extension } from '@typechain/Extension';
import { Repayments } from '@typechain/Repayments';
import { PoolFactory } from '@typechain/PoolFactory';
import { CreditLine } from '@typechain/CreditLine';
import { ERC20 } from '@typechain/ERC20';
import { Verification } from '@typechain/Verification';
import { PriceOracle } from '@typechain/PriceOracle';
import { Pool } from '@typechain/Pool';
import { PoolToken } from '@typechain/PoolToken';
import { BigNumberish, BytesLike } from 'ethers';

export interface Environment {
    savingsAccount: SavingsAccount;
    strategyRegistry: StrategyRegistry;
    yields: Yields;
    verification: Verification;
    priceOracle: PriceOracle;
    extenstion: Extension;
    repayments: Repayments;
    poolFactory: PoolFactory;
    creditLine: CreditLine;
    entities: Entities;
    poolLogic: Pool;
    poolTokenLogic: PoolToken;
    impersonatedAccounts: any[];
    mockTokenContracts: MockTokenContract[];
    inputParams: InputParams;
}

export interface Entities {
    proxyAdmin: SignerWithAddress;
    admin: SignerWithAddress;
    borrower: SignerWithAddress;
    lender: SignerWithAddress;
    protocolFeeCollector: SignerWithAddress;
    extraLenders: SignerWithAddress[];
}

export interface Yields {
    aaveYield: AaveYield;
    yearnYield: YearnYield;
    compoundYield: CompoundYield;
    noStrategy: Address;
}

export interface MockTokenContract {
    name: string;
    contract: ERC20 | PoolToken;
}

export enum CreditLineDefaultStrategy {
    Yearn,
    Compound,
    NoStrategy,
}

export interface InputParams {
    extenstionInitParams: ExtensionInitParams;
    creditLineInitParams: CreditLineInitParams;
    poolFactoryInitParams: PoolFactoryInitParams;
    repaymentInitParams: RepaymentsInitParams;
    priceFeeds: PriceOracleSource[];
    supportedCompoundTokens: CompoundPair[];
    supportedYearnTokens: YearnPair[];
}

export interface ExtensionInitParams {
    votingPassRatio: BigNumberish;
}

export interface CreditLineInitParams {
    _protocolFeeFraction: BigNumberish;
}

export interface PoolFactoryInitParams {
    admin: Address;
    _collectionPeriod: BigNumberish;
    _matchCollateralRatioInterval: BigNumberish;
    _marginCallDuration: BigNumberish;
    _gracePeriodPenaltyFraction: BigNumberish;
    _poolInitFuncSelector: BytesLike;
    _poolTokenInitFuncSelector: BytesLike;
    _liquidatorRewardFraction: BigNumberish;
    _poolCancelPenalityFraction: BigNumberish;
    _protocolFeeFraction: BigNumberish;
    protocolFeeCollector: Address;
}

export interface PriceOracleSource {
    tokenAddress: Address;
    feedAggregator: Address;
}

export interface RepaymentsInitParams {
    gracePenalityRate: BigNumberish;
    gracePeriodFraction: BigNumberish;
}

export interface CompoundPair {
    asset: Address;
    liquidityToken: Address;
}

export interface YearnPair {
    asset: Address;
    liquidityToken: Address;
}

export interface PoolCreateParams {
    _poolSize: BigNumberish;
    _minborrowAmount: BigNumberish;
    _borrowRate: BigNumberish;
    _collateralAmount: BigNumberish;
    _collateralRatio: BigNumberish;
    _collectionPeriod: BigNumberish;
    _matchCollateralRatioInterval: BigNumberish;
    _noOfRepaymentIntervals: BigNumberish;
    _repaymentInterval: BigNumberish;
}
