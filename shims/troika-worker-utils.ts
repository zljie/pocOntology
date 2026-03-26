"use client";

let supportsWorkers: (() => boolean) | undefined;

function workerBootstrap() {
  try {
    const selfAny = self as any;
    selfAny.window = selfAny;
    selfAny.global = selfAny;
  } catch {}

  const modules: Record<string, { id: string; value: any; getTransferables?: ((result: any) => any[]) | null }> =
    Object.create(null);

  function registerModule(
    ref: {
      id: string;
      name: string;
      dependencies?: any[];
      init: any;
      getTransferables?: any;
    },
    callback: (value: any) => void
  ) {
    const id = ref.id;
    const name = ref.name;
    let dependencies = ref.dependencies;
    let init = ref.init;
    let getTransferables = ref.getTransferables;

    if (dependencies === void 0) dependencies = [];
    if (init === void 0) init = function () {};
    if (getTransferables === void 0) getTransferables = null;

    if (modules[id]) return;

    try {
      dependencies = dependencies.map((dep: any) => {
        if (dep && dep.isWorkerModule) {
          registerModule(dep, (depResult) => {
            if (depResult instanceof Error) throw depResult;
          });
          dep = modules[dep.id].value;
        }
        return dep;
      });

      init = rehydrate(`<${name}>.init`, init);
      if (getTransferables) {
        getTransferables = rehydrate(`<${name}>.getTransferables`, getTransferables);
      }

      let value: any = null;
      if (typeof init === "function") {
        value = init.apply(void 0, dependencies as any);
      } else {
        console.error("worker module init function failed to rehydrate");
      }
      modules[id] = {
        id,
        value,
        getTransferables,
      };
      callback(value);
    } catch (err: any) {
      if (!(err && err.noLog)) {
        console.error(err);
      }
      callback(err);
    }
  }

  function callModule(ref: { id: string; args: any[] }, callback: (result: any, tx?: any[]) => void) {
    const id = ref.id;
    const args = ref.args;
    if (!modules[id] || typeof modules[id].value !== "function") {
      callback(new Error(`Worker module ${id}: not found or its 'init' did not return a function`));
      return;
    }
    try {
      const result = modules[id].value.apply(modules[id], args as any);
      if (result && typeof result.then === "function") {
        result.then(handleResult, (rej: any) => callback(rej instanceof Error ? rej : new Error("" + rej)));
      } else {
        handleResult(result);
      }
    } catch (err: any) {
      callback(err);
    }

    function handleResult(result: any) {
      try {
        let tx = modules[id].getTransferables && modules[id].getTransferables(result);
        if (!tx || !Array.isArray(tx) || !tx.length) {
          tx = undefined;
        }
        callback(result, tx);
      } catch (err: any) {
        console.error(err);
        callback(err);
      }
    }
  }

  function rehydrate(name: string, str: string) {
    let result: any = void 0;
    (self as any).troikaDefine = (r: any) => (result = r);
    const url = URL.createObjectURL(
      new Blob([`/** ${name.replace(/\*/g, "")} **/\n\ntroikaDefine(\n${str}\n)`], {
        type: "application/javascript",
      })
    );
    try {
      (self as any).importScripts(url);
    } catch (err) {
      console.error(err);
    }
    URL.revokeObjectURL(url);
    delete (self as any).troikaDefine;
    return result;
  }

  (self as any).addEventListener("message", (e: MessageEvent) => {
    const ref = e.data as { messageId: number; action: string; data: any };
    const messageId = ref.messageId;
    const action = ref.action;
    const data = ref.data;
    try {
      if (action === "registerModule") {
        registerModule(data, (result) => {
          if (result instanceof Error) {
            (self as any).postMessage({ messageId, success: false, error: result.message });
          } else {
            (self as any).postMessage({
              messageId,
              success: true,
              result: { isCallable: typeof result === "function" },
            });
          }
        });
      }
      if (action === "callModule") {
        callModule(data, (result, transferables) => {
          if (result instanceof Error) {
            (self as any).postMessage({ messageId, success: false, error: result.message });
          } else {
            (self as any).postMessage({ messageId, success: true, result }, transferables || undefined);
          }
        });
      }
    } catch (err: any) {
      (self as any).postMessage({ messageId, success: false, error: err.stack });
    }
  });
}

function defineMainThreadModule(options: {
  init: (...args: any[]) => any;
  dependencies?: any[];
}) {
  const moduleFunc: any = (...args: any[]) => {
    return moduleFunc._getInitResult().then((initResult: any) => {
      if (typeof initResult === "function") {
        return initResult.apply(void 0, args as any);
      }
      throw new Error("Worker module function was called but `init` did not return a callable function");
    });
  };

  moduleFunc._getInitResult = () => {
    let dependencies = options.dependencies;
    const init = options.init;
    dependencies = Array.isArray(dependencies)
      ? dependencies.map((dep) => (dep && dep._getInitResult ? dep._getInitResult() : dep))
      : [];

    const initPromise = Promise.all(dependencies).then((deps) => init.apply(null, deps as any));
    moduleFunc._getInitResult = () => initPromise;
    return initPromise;
  };

  return moduleFunc;
}

let _workerModuleId = 0;
let _messageId = 0;
let _allowInitAsString = false;

const workers: Record<string, Worker> = Object.create(null);
const registeredModules: Record<string, Set<() => void>> = Object.create(null);
const openRequests: Record<number, (response: any) => void> = Object.create(null);

function stringifyFunction(fn: any) {
  let str = fn.toString();
  if (!/^function/.test(str) && /^\w+\s*\(/.test(str)) {
    str = "function " + str;
  }
  return str;
}

function getWorker(workerId: string) {
  let worker = workers[workerId];
  if (!worker) {
    const bootstrap = stringifyFunction(workerBootstrap);
    worker = workers[workerId] = new Worker(
      URL.createObjectURL(
        new Blob([`/** Worker Module Bootstrap: ${workerId.replace(/\*/g, "")} **/\n\n;(${bootstrap})()`], {
          type: "application/javascript",
        })
      )
    );

    worker.onmessage = (e) => {
      const response = (e as MessageEvent).data;
      const msgId = response.messageId;
      const callback = openRequests[msgId];
      if (!callback) {
        throw new Error("WorkerModule response with empty or unknown messageId");
      }
      delete openRequests[msgId];
      callback(response);
    };
  }
  return worker;
}

function callWorker(workerId: string, action: string, data: any) {
  return new Promise((resolve, reject) => {
    const messageId = ++_messageId;
    openRequests[messageId] = (response) => {
      if (response.success) {
        resolve(response.result);
      } else {
        reject(new Error(`Error in worker ${action} call: ${response.error}`));
      }
    };
    getWorker(workerId).postMessage({ messageId, action, data });
  });
}

function supportsWorkersImpl() {
  let supported = false;
  if (typeof window !== "undefined" && typeof window.document !== "undefined") {
    try {
      const worker = new Worker(URL.createObjectURL(new Blob([""], { type: "application/javascript" })));
      worker.terminate();
      supported = true;
    } catch (err: any) {
      if (!(typeof process !== "undefined" && process.env.NODE_ENV === "test")) {
        console.log(
          `Troika createWorkerModule: web workers not allowed; falling back to main thread execution. Cause: [${err.message}]`
        );
      }
    }
  }
  supportsWorkers = () => supported;
  return supported;
}

function defineWorkerModule(options: {
  init: any;
  dependencies?: any[];
  getTransferables?: any;
  name?: string;
  workerId?: string;
}) {
  if ((!options || typeof options.init !== "function") && !_allowInitAsString) {
    throw new Error("requires `options.init` function");
  }

  let dependencies = options.dependencies;
  const init = options.init;
  const getTransferables = options.getTransferables;
  let workerId = options.workerId;

  if (!(supportsWorkers ? supportsWorkers() : supportsWorkersImpl())) {
    return defineMainThreadModule(options);
  }

  if (workerId == null) workerId = "#default";

  const id = `workerModule${++_workerModuleId}`;
  const name = options.name || id;
  let registrationPromise: Promise<any> | null = null;

  dependencies =
    dependencies &&
    dependencies.map((dep) => {
      if (typeof dep === "function" && !dep.workerModuleData) {
        _allowInitAsString = true;
        dep = defineWorkerModule({
          workerId,
          name: `<${name}> function dependency: ${dep.name}`,
          init: `function(){return (\n${stringifyFunction(dep)}\n)}`,
        });
        _allowInitAsString = false;
      }
      if (dep && dep.workerModuleData) {
        dep = dep.workerModuleData;
      }
      return dep;
    });

  function moduleFunc(...args: any[]) {
    if (!registrationPromise) {
      registrationPromise = callWorker(workerId!, "registerModule", (moduleFunc as any).workerModuleData) as Promise<any>;
      const unregister = () => {
        registrationPromise = null;
        registeredModules[workerId!].delete(unregister);
      };
      (registeredModules[workerId!] || (registeredModules[workerId!] = new Set())).add(unregister);
    }

    return registrationPromise.then((ref) => {
      const isCallable = ref.isCallable;
      if (isCallable) {
        return callWorker(workerId!, "callModule", { id, args });
      }
      throw new Error("Worker module function was called but `init` did not return a callable function");
    });
  }

  (moduleFunc as any).workerModuleData = {
    isWorkerModule: true,
    id,
    name,
    dependencies,
    init: stringifyFunction(init),
    getTransferables: getTransferables && stringifyFunction(getTransferables),
  };

  return moduleFunc as any;
}

function terminateWorker(workerId: string) {
  if (registeredModules[workerId]) {
    registeredModules[workerId].forEach((unregister) => unregister());
  }
  if (workers[workerId]) {
    workers[workerId].terminate();
    delete workers[workerId];
  }
}

export { defineWorkerModule, stringifyFunction, terminateWorker };
