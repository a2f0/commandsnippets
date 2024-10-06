import WDIOReporter, {type TestStats} from '@wdio/reporter';
import type {Reporters} from '@wdio/types';

export class ConsoleErrorReporter extends WDIOReporter {
  constructor(options: Reporters.Options) {
    super(options);
  }

  onTestEnd(test: TestStats): void {
    if (browser.currentTestErrors.length > 0) {
      const errorMessage = `Test failed due to ${browser.currentTestErrors.length} browser console errors.`;
      test.error = new Error(errorMessage);
      test.state = 'failed';
      throw new Error(errorMessage);
    }
  }
}
