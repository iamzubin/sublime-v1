import { CreditLines } from '../../utils/TestTemplate/CreditLines_template';
import { CreditLines_Calculations } from '../../utils/TestTemplate/CreditLines_Calculation_Checks';
import { psLoanStagesTestCases as testCases } from '../../utils/TestCases/pool_simulations_loan_stages_test_cases';

describe('CreditLine tests', function () {
    testCases.forEach((testCase) => {
        CreditLines(
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

// describe.only('CreditLine Calculation Checks', function () {
//     testCases.forEach((testCase) => {
//         CreditLines_Calculations(
//             testCase.Amount,
//             testCase.Whale1,
//             testCase.Whale2,
//             testCase.BorrowTokenParam,
//             testCase.CollateralTokenParam,
//             testCase.liquidityBorrowTokenParam,
//             testCase.liquidityCollateralTokenParam,
//             testCase.chainlinkBorrowParam,
//             testCase.chainlinkCollateralParam
//         );
//     });
// });
