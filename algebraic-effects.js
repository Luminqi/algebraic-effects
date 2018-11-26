function isGenerator(x) {
  return x !== null && typeof x.next === "function";
}

function runGenerator(gen, arg) {
  const { value, done } = gen.next(arg);

  if (done) {
    const _return = gen._return;
    if (isGenerator(_return)) {
      runGenerator(_return, value);
    } else if (typeof _return === "function") {
      _return(value);
    }
  } else {
    if (isGenerator(value)) {
      value._return = gen;
      runGenerator(value, null);
    } else if (typeof value === "function") {
      value(gen);
    }
  }
}

function start(gen, onDone) {
  gen._return = onDone;
  runGenerator(gen, null);
}

function withHandler(handler, gen) {
  function* withHandlerFrame() {
    const result = yield gen;
    // eventually handles the return value
    if (handler.return) {
      return yield handler.return(result);
    }
    return result;
  }

  const withHandlerGen = withHandlerFrame();
  withHandlerGen._handler = handler;
  return withHandlerGen;
}


const abortHandler = {
  //optional, handles the return value
  // *return(result) {
  //   // ...
  // },
  *abort(msg) {
    console.error(msg);
    return 0;
  }
};

function perform(type, data) {
  return performGen => {
    // finds the closest handler for effect `type`
    let withHandlerGen = performGen;
    while (
      !withHandlerGen._handler ||
      !withHandlerGen._handler.hasOwnProperty(type)
    ) {
      if (!withHandlerGen._return) break;
      withHandlerGen = withHandlerGen._return;
    }

    if (
      withHandlerGen._handler === null ||
      !withHandlerGen._handler.hasOwnProperty(type)
    ) {
      throw new Error(`Unhandled Effect ${type}!`);
    }

    // found a handler, get the withHandler Generator
    const handlerFunc = withHandlerGen._handler[type];
    // const handlerGen = handlerFunc(data);
    const handlerGen = handlerFunc(data, function resume(value) {
      return currentGen => {
        withHandlerGen._return = currentGen;
        runGenerator(performGen, value);
      };
    });

    // will return to the parent of withHandler
    handlerGen._return = withHandlerGen._return;
    runGenerator(handlerGen, null);
  };
}

// function* main(n) {
//   return yield handler(n);
// }

// function* handler(n) {
//   return yield withHandler(abortHandler, unsafeOperation(n));
// }

// function* unsafeOperation(n) {
//   const x = yield oneMoreIndirection(n);
//   return x * 2;
// }

// function* oneMoreIndirection(n) {
//   if (n < 0) {
//     // throw
//     yield perform("abort", "can't be under zero!");
//   }
//   return n + 1;
// }

// start(main(2), console.log);
// // => 6

// start(main(-1), console.log);
// // => can't be under zero!
// // => 0

const constRead = {
  *read(_, resume) {
    const result = yield resume("Stranger");
    return result;
  }
};

// function* main() {
//   return yield withHandler(constRead, greet());
// }

// function* greet() {
//   const name = yield withCivility();
//   return `Hi, ${name}`;
// }

// function* withCivility() {
//   // throw the `read` effect
//   const name = yield perform("read");
//   return `M. ${name}`;
// }

// start(main(), console.log);
// // => Hi, M.Stranger;

function log(msg) {
  return perform("log", msg);
}

// const reverseLog = {
//   *log(msg, resume) {
//     yield resume();
//     console.log(msg);
//   }
// };

// function* main() {
//   return yield withHandler(reverseLog, parent());
// }

// function* parent() {
//   yield child();
// }

// function* child() {
//   yield log("A");
//   yield log("B");
//   yield log("C");
// }

const reverseLog = {
  *log(msg, resume) {
    yield resume();
    console.log(msg);
    yield log(msg);
  }
};

const collectLogs = {
  *return(x) {
    return [x, ""];
  },
  *log(msg, resume) {
    const [x, acc] = yield resume();
    return [x, `${msg} ${acc}`];
  }
};

// function* main() {
//   return yield withHandler(collectLogs, withHandler(reverseLog, parent()));
// }

// function* parent() {
//   return yield child();
// }

// function* child() {
//   yield log("A");
//   yield log("B");
//   yield log("C");
//   return 10;
// }

// start(main(), console.log);

abortZero = {
  *abort () {
    return 0
  }
}

// function* main () {
//   return yield withHandler(abortZero, times([1, 2, 0, 4]))
// }
// function* times (arr) {
//   if (arr.length === 0) return 1
//   if (arr[0] === 0) yield perform('abort')
//   // if (arr[0] === 0) return 0
//   if (arr[0] !== 0) return arr[0]*(yield times(arr.slice(1)))
// }

// start(main(), console.log)

resumeComputation = {
  *resume (_, resume) {
    yield resume([])
  } 
}

function* main () {
  return yield withHandler(resumeComputation, idLst([1, 2, 3, 4]))
}

function* idLst (arr) {
  if (arr.length === 0) {
    // return []
    yield perform('resume')
  } else {
    return [arr[0], ...(yield idLst(arr.slice(1)))]
  }
}

start(main(), console.log)