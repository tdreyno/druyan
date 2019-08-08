import { isEqual } from "lodash";
import { Context } from "../types";

declare global {
  namespace jest {
    interface Matchers<R> {
      toMatchEffect(context: any, label: string, data?: any): any;
      toContainEffect(context: any, label: string, data?: any): any;
    }
  }
}

expect.extend({
  toMatchEffect(
    this: jest.MatcherUtils,
    received: any,
    context: Context,
    label: string,
    data?: any,
  ) {
    let result: any;

    try {
      result = received({
        ...context,
        conversation: jest.fn(),
        t: (a: string) => a,
      });
    } catch (e) {
      return {
        pass: false,
        message: () => `Expected not to throw: ${e.message}`,
      };
    }

    const matched =
      result.label === label && (data ? isEqual(result.data, data) : true);

    if (matched && !this.isNot) {
      return {
        pass: true,
        message: () =>
          `expected ${this.utils.printReceived(
            result,
          )} to match ${this.utils.printExpected({ label, data })}`,
      };
    } else {
      return {
        pass: false,
        message: () =>
          `expected ${this.utils.printReceived(
            result,
          )} to match ${this.utils.printExpected({ label, data })}`,
      };
    }
  },

  async toContainEffect(
    this: jest.MatcherUtils,
    received: any,
    context: Context,
    label: string,
    data?: any,
  ) {
    let result: any[];

    try {
      result = await received({
        ...context,
        conversation: jest.fn(),
        t: (a: string) => a,
      });
    } catch (e) {
      return {
        pass: false,
        message: () => `Expected not to throw: ${e.message}`,
      };
    }

    let matched: any[];

    try {
      matched = result.find(
        r => r.label === label && (data ? isEqual(r.data, data) : true),
      );
    } catch (e) {
      return {
        pass: false,
        message: () => `Not a list: ${label}`,
      };
    }

    if (matched && !this.isNot) {
      return {
        pass: true,
        message: () =>
          `expected ${this.utils.printReceived(
            result,
          )} to contain ${this.utils.printExpected({ name, data })}`,
      };
    } else {
      return {
        pass: false,
        message: () =>
          `expected ${this.utils.printReceived(
            result,
          )} to contain ${this.utils.printExpected({ name, data })}`,
      };
    }
  },
});
