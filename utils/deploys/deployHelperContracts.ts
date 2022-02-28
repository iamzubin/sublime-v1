import { Signer } from 'ethers';

import { Verification } from '../../typechain/Verification';
import { TwitterVerifier } from '../../typechain/TwitterVerifier';
import { PriceOracle } from '../../typechain/PriceOracle';
import { SublimeProxy } from '../../typechain/SublimeProxy';
import { IWETH9 } from '../../typechain/IWETH9';
import { PoolUtils } from '../../typechain/PoolUtils';
import { CreditLineUtils } from '../../typechain/CreditLineUtils';
import { SavingsAccountEthUtils } from '../../typechain/SavingsAccountEthUtils';
import { Beacon } from '../../typechain/Beacon';
import { MinimumBeaconProxy } from '../../typechain/MinimumBeaconProxy';

import { Verification__factory } from '../../typechain/factories/Verification__factory';
import { TwitterVerifier__factory } from '../../typechain/factories/TwitterVerifier__factory';
import { PriceOracle__factory } from '../../typechain/factories/PriceOracle__factory';
import { SublimeProxy__factory } from '../../typechain/factories/SublimeProxy__factory';
import { IWETH9__factory } from '../../typechain/factories/IWETH9__factory';
import { PoolUtils__factory } from '../../typechain/factories/PoolUtils__factory';
import { CreditLineUtils__factory } from '../../typechain/factories/CreditLineUtils__factory';
import { SavingsAccountEthUtils__factory } from '../../typechain/factories/SavingsAccountEthUtils__factory';
import { Beacon__factory } from '../../typechain/factories/Beacon__factory';
import { MinimumBeaconProxy__factory } from '../../typechain/factories/MinimumBeaconProxy__factory';

import { Address } from 'hardhat-deploy/dist/types';

export default class DeployHelperContracts {
    private _deployerSigner: Signer;

    constructor(deployerSigner: Signer) {
        this._deployerSigner = deployerSigner;
    }

    public async deployPoolUtils(weth: Address, bin: Address): Promise<PoolUtils> {
        return await new PoolUtils__factory(this._deployerSigner).deploy(weth, bin);
    }

    public async getPoolUtils(contractAddress: Address): Promise<PoolUtils> {
        return await new PoolUtils__factory(this._deployerSigner).attach(contractAddress);
    }

    public async deploySavingsAccountEthUtils(weth: Address, savingsAccount: Address): Promise<SavingsAccountEthUtils> {
        return await new SavingsAccountEthUtils__factory(this._deployerSigner).deploy(weth, savingsAccount);
    }

    public async getSavingsAccountEthUtils(contractAddress: Address): Promise<SavingsAccountEthUtils> {
        return await new SavingsAccountEthUtils__factory(this._deployerSigner).attach(contractAddress);
    }

    public async deployCreditLinesUtils(weth: Address, creditlines: Address): Promise<CreditLineUtils> {
        return await new CreditLineUtils__factory(this._deployerSigner).deploy(weth, creditlines);
    }

    public async getCreditlinesUtils(contractAddress: Address): Promise<CreditLineUtils> {
        return await new CreditLineUtils__factory(this._deployerSigner).attach(contractAddress);
    }

    public async getIWETH9(contractAddress: Address): Promise<IWETH9> {
        return await IWETH9__factory.connect(contractAddress, this._deployerSigner);
    }

    public async deployMinimumBeaconProxy(beacon: Address): Promise<MinimumBeaconProxy> {
        return await await new MinimumBeaconProxy__factory(this._deployerSigner).deploy(beacon);
    }

    public async deployBeacon(owner: Address, implementation: Address): Promise<Beacon> {
        return await await new Beacon__factory(this._deployerSigner).deploy(owner, implementation);
    }

    public async deployVerification(): Promise<Verification> {
        return await (await new Verification__factory(this._deployerSigner).deploy()).deployed();
    }

    public async getVerification(verificationAddress: Address): Promise<Verification> {
        return await new Verification__factory(this._deployerSigner).attach(verificationAddress);
    }

    public async deployTwitterVerifier(): Promise<TwitterVerifier> {
        return await (await new TwitterVerifier__factory(this._deployerSigner).deploy()).deployed();
    }

    public async getTwitterVerifier(twitterVerifierAddress: Address): Promise<TwitterVerifier> {
        return await new TwitterVerifier__factory(this._deployerSigner).attach(twitterVerifierAddress);
    }

    public async deployPriceOracle(): Promise<PriceOracle> {
        return await (await new PriceOracle__factory(this._deployerSigner).deploy()).deployed();
    }

    public async getPriceOracle(priceOracleAddress: Address): Promise<PriceOracle> {
        return await new PriceOracle__factory(this._deployerSigner).attach(priceOracleAddress);
    }

    public async deploySublimeProxy(logic: Address, admin: Address): Promise<SublimeProxy> {
        return await (await new SublimeProxy__factory(this._deployerSigner).deploy(logic, admin, Buffer.from(''))).deployed();
    }
    public async getSublimeProxy(proxy: Address): Promise<SublimeProxy> {
        return await new SublimeProxy__factory(this._deployerSigner).attach(proxy);
    }
}
