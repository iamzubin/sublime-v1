import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';

import DeployHelper from '../deploys';

import { Verification } from '@typechain/Verification';
import { SublimeProxy } from '@typechain/SublimeProxy';

export async function createVerificationWithInit(proxyAdmin: SignerWithAddress, admin: SignerWithAddress): Promise<Verification> {
    const deployHelper: DeployHelper = new DeployHelper(proxyAdmin);
    let verificationLogic: Verification = await deployHelper.helper.deployVerification();
    let verificationProxy: SublimeProxy = await deployHelper.helper.deploySublimeProxy(verificationLogic.address, proxyAdmin.address);
    let verification = await deployHelper.helper.getVerification(verificationProxy.address);
    await verification.connect(admin).initialize(admin.address);
    // await verification.connect(admin).registerUser(borrower.address, sha256(Buffer.from('Borrower')));
    return verification;
}
