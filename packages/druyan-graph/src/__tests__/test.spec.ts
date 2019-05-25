import { parseStates, toDot } from "../index";

function goto(_: any) {
  return void 0;
}

function goBack() {
  return void 0;
}

// function noop() {}

function A(action: any) {
  switch (action.type) {
    case "Enter":
      return goto(B);
  }
}

function B(action: any) {
  switch (action.type) {
    case "Enter":
      // tslint:disable-next-line:no-constant-condition
      return true ? goto(C) : goto(D);
  }
}

function C(action: any) {
  switch (action.type) {
    case "Enter":
      return goBack();
  }
}

function D(action: any) {
  switch (action.type) {
    case "Enter":
      return goBack();
  }
}

const result = parseStates({
  A,
  B,
  C,
  D,
});

// tslint:disable-next-line:no-console
console.log(result);

const dot = toDot(result);

// tslint:disable-next-line:no-console
console.log(dot);
