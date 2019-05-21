import { parse } from "@babel/parser";
const traverse = require("@babel/traverse").default;

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
  const target = goto.node.arguments[0].property.name;
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
      CallExpression: function(path: any) {
        if (path.node.callee.property.name === "goto") {
          gotos.push(path);
        }
      },
    });

    return gotos.map(generateActionMap);
  }
}

export function parseStates(stateMap: { [key: string]: Function }) {
  return Object.values(stateMap)
    .map(parseState)
    .flat()
    .reduce((sum, data) => {
      sum[data.state] = sum[data.state] || {};

      sum[data.state][data.action] = data.target;

      return sum;
    }, {});
}
