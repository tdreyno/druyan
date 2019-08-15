// tslint:disable: max-classes-per-file
import { StateTransition } from "./state";

export class History<
  T extends StateTransition<any, any, any> = StateTransition<any, any, any>
> {
  constructor(private items: T[], private maxHistory = Infinity) {
    if (items.length <= 0) {
      throw new Error(
        "History must contain atleast one previous (or initial) state",
      );
    }
  }

  get current(): T {
    return this.items[0];
  }

  get previous(): T | undefined {
    return this.items[1];
  }

  get length(): number {
    return this.items.length;
  }

  push(item: T): void {
    this.items.unshift(item);

    if (this.items.length > this.maxHistory) {
      this.items = this.items.slice(0, this.maxHistory);
    }
  }

  pop(): void {
    this.items.shift();
  }

  toArray(): T[] {
    return [...this.items];
  }

  map<B>(fn: (item: T) => B): B[] {
    return this.toArray().map(fn);
  }
}

interface Options {
  maxHistory: number;
  allowUnhandled: boolean;
  onAsyncEnterExit: "throw" | "warn" | "silent";
  disableLogging: boolean;
  customLogger?: (msgs: any[], level: "error" | "warn" | "log") => void;
}

export class Context {
  constructor(
    public history: History,
    private options: Omit<Options, "maxHistory">,
  ) {}

  get allowUnhandled() {
    return this.options.allowUnhandled;
  }

  get onAsyncEnterExit() {
    return this.options.onAsyncEnterExit;
  }

  get disableLogging() {
    return this.options.disableLogging;
  }

  get customLogger() {
    return this.options.customLogger;
  }

  get currentState() {
    return this.history.current;
  }
}

export function createInitialContext(
  history: Array<StateTransition<any, any, any>> = [],
  options?: Partial<Options>,
): Context {
  return new Context(
    new History(history, (options && options.maxHistory) || Infinity),
    {
      allowUnhandled: (options && options.allowUnhandled) || false,
      onAsyncEnterExit: (options && options.onAsyncEnterExit) || "warn",
      disableLogging: (options && options.disableLogging) || false,
      customLogger: (options && options.customLogger) || undefined,
    },
  );
}
