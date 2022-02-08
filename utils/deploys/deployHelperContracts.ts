import { Signer } from 'ethers';

import { Verification } from '../../typechain/Verification';
import { TwitterVerifier } from '../../typechain/TwitterVerifier';
import { PriceOracle } from '../../typechain/PriceOracle';
import { SublimeProxy } from '../../typechain/SublimeProxy';

import { Verification__factory } from '../../typechain/factories/Verification__factory';
import { TwitterVerifier__factory } from '../../typechain/factories/TwitterVerifier__factory';
import { PriceOracle__factory } from '../../typechain/factories/PriceOracle__factory';
import { SublimeProxy__factory } from '../../typechain/factories/SublimeProxy__factory';

import { Address } from 'hardhat-deploy/dist/types';

export default class DeployHelperContracts {
    private _deployerSigner: Signer;

    constructor(deployerSigner: Signer) {
        this._deployerSigner = deployerSigner;
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
