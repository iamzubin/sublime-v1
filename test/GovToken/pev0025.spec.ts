import { ethers, network } from 'hardhat';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { BigNumber, BigNumberish } from '@ethersproject/bignumber';
import { expect } from 'chai';

import DeployHelper from '../../utils/deploys';
import { TokenLogic } from '../../typechain/TokenLogic';
import { SublimeProxy } from '../../typechain/SublimeProxy';

describe.only('Sublime Governance Contract', async () => {
    let govToken: TokenLogic;
    let proxyAdmin: SignerWithAddress;
    let admin: SignerWithAddress;
    let randomAddress: SignerWithAddress;
    let mockBridge: SignerWithAddress;

    before(async () => {
        [proxyAdmin, admin, , , , , randomAddress, mockBridge] = await ethers.getSigners();
        let deployHelper: DeployHelper = new DeployHelper(proxyAdmin);
        let tokenLogic: TokenLogic = await deployHelper.core.deployGovTokenLogic();
        let sublimeProxy: SublimeProxy = await deployHelper.helper.deploySublimeProxy(tokenLogic.address, proxyAdmin.address);
        govToken = await deployHelper.core.getGovToken(sublimeProxy.address);

        await govToken.connect(admin).initialize(admin.address, mockBridge.address);
    });

    it('Decrease allowance when removeAmount is uint256(-1)', async () => {
        let uint96max = BigNumber.from(2).pow(96).sub(1).toString();
        let uint256max = BigNumber.from(2).pow(256).sub(1).toString();
        govToken = govToken.connect(admin);

        await govToken.connect(admin).increaseAllowance(randomAddress.address, uint256max);
        let allowanceFromChainAfterIncreasing = (await govToken.allowance(admin.address, randomAddress.address)).toString();

        await govToken.connect(admin).decreaseAllowance(randomAddress.address, uint256max);
        let allowanceFromChainAfterDecreasing = (await govToken.allowance(admin.address, randomAddress.address)).toString();
        console.log({ allowanceFromChainAfterIncreasing, allowanceFromChainAfterDecreasing, uint96max, uint256max });
    });
});
