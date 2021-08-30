import { compoundPoolCollectionStage } from '../../utils/TestTemplate/Compound_poolLoanStages';
import { psLoanStagesTestCases as testCases } from '../../utils/TestCases/pool_simulations_loan_stages_test_cases';

describe('Pool simulation using Compound strategy', function () {
    testCases.forEach((testCase) => {
        compoundPoolCollectionStage(
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
