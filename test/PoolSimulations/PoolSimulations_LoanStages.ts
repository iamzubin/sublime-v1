import { compoundPoolCollectionStage } from '../../utils/TestTemplate/Compound_poolLoanStages';
import { yearnPoolCollectionStage } from '../../utils/TestTemplate/Yearn_poolLoanStages';
import { compound_RequestExtension } from '../../utils/TestTemplate/Compound_RequestExtension';
import { yearn_MarginCalls } from '../../utils/TestTemplate/Yearn_MarginCalls';
import { psLoanStagesTestCases as testCases } from '../../utils/TestCases/pool_simulations_loan_stages_test_cases';
import { psYearnTestCases as YearnTestcases } from '../../utils/TestCases/pool_simulations_yearn_test_cases';

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

    testCases.forEach((testCase) => {
        compound_RequestExtension(
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

xdescribe('Pool simulation using Yearn strategy', function () {
    YearnTestcases.forEach((testCase) => {
        yearnPoolCollectionStage(
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

    YearnTestcases.forEach((testCase) => {
        yearn_MarginCalls(
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
