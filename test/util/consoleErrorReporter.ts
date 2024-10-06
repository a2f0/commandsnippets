import WDIOReporter, {type TestStats} from '@wdio/reporter';
import type {Reporters} from '@wdio/types';

export class ConsoleErrorReporter extends WDIOReporter {
  constructor(options: Reporters.Options) {
    super(options);
  }

  onTestEnd(test: TestStats): void {
    if (browser.currentTestErrors.length > 0) {
      test.error = new Error(
        `Test failed due to ${browser.currentTestErrors.length} browser console errors.`
      );
      test.state = 'failed';
    }
  }
}
