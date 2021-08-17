import { poolCreationTest } from '../../utils/templates/poolGenerationTemplate';

import {Contracts} from '../../existingContracts/compound.json'

import {
    DAIWhale,
    LINKWhale,
    ChainLinkAggregators,
} from '../../utils/constants-rahul';

describe("Testing", async () => {
    await poolCreationTest(
        DAIWhale,
        LINKWhale,
        Contracts.DAI,
        Contracts.LINK,
        Contracts.cDAI,
        "0x95812193E603cA35b55025C242934BAd1a308305",
        ChainLinkAggregators['DAI/USD'],
        ChainLinkAggregators['LINK/USD']
    )
});

