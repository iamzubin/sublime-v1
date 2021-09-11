import { compoundPoolCollectionStage } from '../../utils/TestTemplate/Compound_poolLoanStages';
import { compound_MarginCalls } from '../../utils/TestTemplate/Compound_MarginCalls';
import { psLoanStagesTestCases as testCases } from '../../utils/TestCases/pool_simulations_loan_stages_test_cases';

describe.only('Pool simulation using Compound strategy', function () {
    // testCases.forEach((testCase) => {
    //     compoundPoolCollectionStage(
    //         testCase.Amount,
    //         testCase.Whale1,
    //         testCase.Whale2,
    //         testCase.BorrowTokenParam,
    //         testCase.CollateralTokenParam,
    //         testCase.liquidityBorrowTokenParam,
    //         testCase.liquidityCollateralTokenParam,
    //         testCase.chainlinkBorrowParam,
    //         testCase.chainlinkCollateralParam
    //     );
    // });

    testCases.forEach((testCase) => {
        compound_MarginCalls(
            testCase.Amount,
            testCase.Whale1,
            testCase.Whale2,
            testCase.BorrowTokenParam,
            testCase.CollateralTokenParam,
            testCase.liquidityBorrowTokenParam,
            testCase.liquidityCollateralTokenParam,
            testCase.chainlinkBorrowParam,
            testCase.chainlinkCollateralParam
        );
    });
});
