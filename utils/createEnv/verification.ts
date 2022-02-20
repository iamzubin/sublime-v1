import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';

import DeployHelper from '../deploys';

import { Verification } from '@typechain/Verification';
import { SublimeProxy } from '@typechain/SublimeProxy';
import { TwitterVerifier } from '@typechain/TwitterVerifier';
import { BigNumberish } from '@ethersproject/providers/node_modules/@ethersproject/bignumber';
import { VerificationParams } from '@utils/types';

export async function createVerificationWithInit(
    proxyAdmin: SignerWithAddress,
    admin: SignerWithAddress,
    verificationParams: VerificationParams
): Promise<Verification> {
    const deployHelper: DeployHelper = new DeployHelper(proxyAdmin);
    let verificationLogic: Verification = await deployHelper.helper.deployVerification();
    let verificationProxy: SublimeProxy = await deployHelper.helper.deploySublimeProxy(verificationLogic.address, proxyAdmin.address);
    let verification = await deployHelper.helper.getVerification(verificationProxy.address);
    await verification.connect(admin).initialize(admin.address, verificationParams.activationDelay);
    return verification;
}

export async function createTwitterVerifierWithInit(
    proxyAdmin: SignerWithAddress,
    admin: SignerWithAddress,
    verification: Verification
): Promise<TwitterVerifier> {
    const deployHelper: DeployHelper = new DeployHelper(proxyAdmin);
    let twitterVerifierLogic: TwitterVerifier = await deployHelper.helper.deployTwitterVerifier();
    let twitterVerifierProxy: SublimeProxy = await deployHelper.helper.deploySublimeProxy(twitterVerifierLogic.address, proxyAdmin.address);
    let twitterVerifier = await deployHelper.helper.getTwitterVerifier(twitterVerifierProxy.address);
    await (await twitterVerifier.connect(admin).initialize(admin.address, verification.address, admin.address)).wait();
    // await verification.connect(admin).registerUser(borrower.address, sha256(Buffer.from('Borrower')));
    return twitterVerifier;
}
