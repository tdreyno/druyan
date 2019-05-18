import { isEqual } from "lodash";
import { Context } from "../Context";

declare global {
  namespace jest {
    interface Matchers<R> {
      toMatchEffect<C extends Context>(
        context: C,
        name: string,
        data?: any,
      ): any;
      toContainEffect<C extends Context>(
        context: C,
        name: string,
        data?: any,
      ): any;
    }
  }
}

expect.extend({
  toMatchEffect<C extends Context>(
    this: jest.MatcherUtils,
    received: any,
    context: C,
    name: string,
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
      result.name === name && (data ? isEqual(result.data, data) : true);

    if (matched && !this.isNot) {
      return {
        pass: true,
        message: () =>
          `expected ${this.utils.printReceived(
            result,
          )} to match ${this.utils.printExpected({ name, data })}`,
      };
    } else {
      return {
        pass: false,
        message: () =>
          `expected ${this.utils.printReceived(
            result,
          )} to match ${this.utils.printExpected({ name, data })}`,
      };
    }
  },

  async toContainEffect<C extends Context>(
    this: jest.MatcherUtils,
    received: any,
    context: C,
    name: string,
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
        r => r.name === name && (data ? isEqual(r.data, data) : true),
      );
    } catch {
      return {
        pass: false,
        message: () => `Not a list: ${name}`,
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