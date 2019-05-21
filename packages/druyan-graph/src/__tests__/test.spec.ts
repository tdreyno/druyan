import { parseStates, toDot } from "../index";

function goto(_: any) {}

function goBack() {}

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

console.log(result);

const dot = toDot(result);

console.log(dot);
