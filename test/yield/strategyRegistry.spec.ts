import { ethers } from 'hardhat';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { expect } from 'chai';

import DeployHelper from '../../utils/deploys';
import { StrategyRegistry } from '../../typechain/StrategyRegistry';
import { getRandomFromArray } from '../../utils/helpers';

describe('Test Strategy Registry', async () => {
    let strategyRegistry: StrategyRegistry;

    let mockCreditLinesAddress: SignerWithAddress;
    let proxyAdmin: SignerWithAddress;
    let admin: SignerWithAddress;

    let randomStrategy: SignerWithAddress;
    before(async () => {
        [proxyAdmin, admin, mockCreditLinesAddress] = await ethers.getSigners();
        const deployHelper: DeployHelper = new DeployHelper(proxyAdmin);
        strategyRegistry = await deployHelper.core.deployStrategyRegistry();
        randomStrategy = getRandomFromArray(await ethers.getSigners());
    });

    it('Initialize Strategy Registry', async () => {
        await strategyRegistry.initialize(admin.address, 10);
    });

    describe('Add Strategy', async () => {
        it('Add a new stragegy', async () => {
            await expect(strategyRegistry.connect(admin).addStrategy(randomStrategy.address))
                .to.emit(strategyRegistry, 'StrategyAdded')
                .withArgs(randomStrategy.address);
        });

        it('Get Strategies', async () => {
            expect(await strategyRegistry.getStrategies()).to.include(randomStrategy.address);
        });

        it('Update Max Strategies', async () => {
            await expect(strategyRegistry.connect(admin).updateMaxStrategies(100))
                .to.emit(strategyRegistry, 'MaxStrategiesUpdated')
                .withArgs(100);
        });
    });

    describe('Update Strategy', async () => {
        it('Should revert if wrong strategy index is provided', async () => {
            await expect(strategyRegistry.connect(admin).updateStrategy(1, randomStrategy.address, admin.address)).to.be.revertedWith(
                'StrategyRegistry:: _strategy index cannot be more than array length'
            );
        });

        it('Update', async () => {
            await expect(strategyRegistry.connect(admin).updateStrategy(0, randomStrategy.address, admin.address)).to.emit(
                strategyRegistry,
                'StrategyAdded'
            );
        });
    });

    describe('Failed cases', async () => {
        it('Should fail when tried to initialize twice', async () => {
            await expect(strategyRegistry.initialize(admin.address, 10)).to.be.revertedWith(
                'Initializable: contract is already initialized'
            );
        });

        it('Should fail adding the same stragegy twice or more', async () => {
            await strategyRegistry.connect(admin).updateStrategy(0, admin.address, randomStrategy.address);

            await expect(strategyRegistry.connect(admin).addStrategy(randomStrategy.address)).to.be.revertedWith(
                'StrategyRegistry::addStrategy - Strategy already exists'
            );
        });
    });

    describe('Remove Strategy', async () => {
        it('Shouold throw error if non-admin tried to remove strategy', async () => {
            await expect(strategyRegistry.connect(mockCreditLinesAddress).removeStrategy(0)).to.be.revertedWith('as');
        });

        it('Should remove strategy by admin', async () => {
            await expect(strategyRegistry.connect(admin).removeStrategy(0)).to.emit(strategyRegistry, 'StrategyRemoved');
        });
    });
});
