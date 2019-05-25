import { parse } from "@babel/parser";

// tslint:disable-next-line:no-var-requires
const traverse = require("@babel/traverse").default;

// tslint:disable
if (!Array.prototype.flat) {
  Array.prototype.flat = function(depth: any) {
    var flattend = [];
    (function flat(array, depth) {
      for (let el of array) {
        if (Array.isArray(el) && depth > 0) {
          flat(el, depth - 1);
        } else {
          flattend.push(el);
        }
      }
    })(this, Math.floor(depth || 1) || 1);
    return flattend;
  };
}
// tslint:enable

const GO_BACK = Symbol("goBack");

function generateActionMap(goto: any) {
  // console.log(goto);

  let state;
  let action;

  let parentPath = goto.parentPath;
  while (parentPath) {
    // console.log(parentPath.type);

    if (parentPath.type === "SwitchCase") {
      // console.log(parentPath.node.test);
      action = parentPath.node.test.value;
    }

    if (
      parentPath.parentPath.type === "Program" &&
      parentPath.type === "FunctionDeclaration"
    ) {
      state = parentPath.node.id.name;
      // console.log("State: " + state);

      break;
    }

    parentPath = parentPath.parentPath;
  }

  // TODO: Resolve ternaries and variables in goto
  const identifier = goto.node.callee.property || goto.node.callee;
  const target =
    identifier.name === "goto"
      ? (goto.node.arguments[0].property || goto.node.arguments[0]).name
      : GO_BACK;

  // console.log("Action: " + action + " -> " + target);

  return {
    state,
    action,
    target,
  };
}

function parseState(state: any) {
  const ast = parse(state.toString());

  const functionAST = ast.program.body[0];

  if (functionAST.type === "FunctionDeclaration") {
    const gotos: any[] = [];

    traverse(ast, {
      CallExpression(path: any) {
        const identifier = path.node.callee.property || path.node.callee;

        if (
          identifier &&
          (identifier.name === "goto" || identifier.name === "goBack")
        ) {
          gotos.push(path);
        }
      },
    });

    return gotos.map(generateActionMap);
  }
}

export function parseStates(stateMap: {
  [key: string]: (...args: any[]) => any;
}) {
  return Object.values(stateMap)
    .map(parseState)
    .flat()
    .reduce((sum, data) => {
      sum[data.state] = sum[data.state] || {};
      sum[data.state][data.action] = sum[data.state][data.action] || new Set();

      sum[data.state][data.action].add(data.target);

      return sum;
    }, {});
}

export function toDot(data: {
  [key: string]: { [key: string]: Set<string | symbol> };
}): string {
  const arrows = Object.keys(data)
    .map(state => {
      const actions = data[state];

      return Object.keys(actions)
        .map(action => {
          const targets = actions[action];

          return Array.from(targets).map(target => {
            return { action, state, target };
          });
        })
        .flat();
    })
    .flat();

  // tslint:disable-next-line:no-console
  console.log(arrows);

  const final = arrows.reduce(
    (sum, arrow) => {
      if (arrow.target !== GO_BACK) {
        sum.push(arrow);
        return sum;
      }

      const statesPointingAtState = arrows
        .filter(a => a.target === arrow.state)
        .map(a => a.state);

      return sum.concat(
        statesPointingAtState.map(t => {
          return { action: arrow.action, state: arrow.state, target: t };
        }),
      );
    },
    [] as any[],
  );

  return `digraph G {
    ${final
      .map(
        ({ action, state, target }: any) =>
          `${state} -> ${target} [ label="${action}" ]`,
      )
      .join("\n")}
  }`;
}
