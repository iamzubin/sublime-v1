import { cancellationChecks } from '../../utils/TestTemplate/poolLendings';
import { psLoanStagesTestCases as testCases } from '../../utils/TestCases/pool_simulations_loan_stages_test_cases';

describe('Pool simulation for different lending scenarios: ', function () {
    testCases.forEach((testCase) => {
        cancellationChecks(
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
