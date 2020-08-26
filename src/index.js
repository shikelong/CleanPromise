
const isFunction = (fn) => {
  return typeof fn === 'function';
}

const _STATUS = {
  pending: Symbol('pending'),
  fulfilled: Symbol('fulfilled'),
  rejected: Symbol('rejected')
}

class Promise {
  #status
  #value
  #reason

  #callbacks = [];

  constructor(executor) {

    const self = this;

    if (!isFunction(executor)) {
      throw new Error("Promise constructor's argument must be a function.")
    }

    self.#status = _STATUS.pending;

    function resolve(value) {
      if (self.#status === _STATUS.pending) {
        self.#value = value;
        self.#status = _STATUS.fulfilled;
        globalThis.queueMicrotask(() => {
          self.#callbacks.forEach(callback => callback.onFulfilled(self.#value))
        })
      }
    }

    function reject(error) {
      if (self.#status === _STATUS.pending) {
        self.#reason = error;
        self.#status = _STATUS.rejected;
        globalThis.queueMicrotask(() => {
          self.#callbacks.forEach(callback => callback.onRejected(self.#reason))
        })
      }
    }

    try {
      executor(resolve, reject);
    } catch (e) {
      reject(e);
    }

  }

  get status() {
    return this.#status;
  }

  then(onFulfilled, onRejected) {

    if (!isFunction(onFulfilled)){
      onFulfilled = v => v;
    }
    if (!isFunction(onRejected)){
      onRejected = err => {throw err};
    }

    //avoid repeat code
    function excuteChildProcess(valueOrReason, onDone, resolve, reject, newPromise){
      try {
        let result = onDone(valueOrReason);
        resolver(newPromise, result, resolve, reject);
      } catch (e){
        reject(e);
      }
    }

    //The promise resolution procedure
    function resolver(newPromise, x, resolve, reject){
      if (newPromise === x){
        return reject(new TypeError("new promise cannot be equal with x"));
      }

      let hasSettled = false;
      
      if (x instanceof Promise){
        if (x.#status === _STATUS.pending){
          //?
          x.then((v) => resolver(newPromise, v, resolve, reject), reject);
        } else {
          x.then(resolve, reject);
        }
      } else if (x !== null && (isFunction(x) || typeof x === "object")){
        try {
          let then = x.then;
          if (isFunction(then)){
            then.call(x, (value) => {
              if (hasSettled){
                return;
              }
              hasSettled = true;
              return resolver(newPromise, value, resolve, reject);
            }, (reason) => {
              if (hasSettled){
                return;
              }
              hasSettled = true;
              return reject(reason);
            });
          } else {
            return resolve(x);
          }
        } catch (e) {
          if (hasSettled){
            return;
          }
          hasSettled = true;
          reject(e);
        }

      } else {
        return resolve(x);
      }
    }

    let newPromise;
    switch (this.#status) {
      case _STATUS.pending:
        newPromise = new Promise((resolve, reject) => {
          this.#callbacks.push({
            onFulfilled: (value) => excuteChildProcess(value, onFulfilled, resolve, reject, newPromise),
            onRejected: (reason) => excuteChildProcess(reason, onRejected, resolve, reject, newPromise)
          })
        });
        break;
      case _STATUS.fulfilled:
        newPromise = new Promise((resolve, reject) => {
          global.queueMicrotask(() => excuteChildProcess(this.#value, onFulfilled, resolve, reject, newPromise))
        });
        break;
      case _STATUS.rejected:
        newPromise = new Promise((resolve, reject) => {
          global.queueMicrotask(() => excuteChildProcess(this.#reason, onRejected, resolve, reject, newPromise))
        });
        break;
    }

    return newPromise;
  }

  //TODO:
  catch(onRejected) {

  }

  finally() {

  }

  static resolve() {
    
  }

  static reject() {

  }

  static race() {

  }

  static all() {

  }

  //for unit-test providered by promises-aplus-tests 
  static deferred() {
    let dfd = {};
    dfd.promise = new Promise((resolve, reject) => {
      dfd.resolve = resolve;
      dfd.reject = reject;
    });
    return dfd;
  }
}



module.exports = Promise;


// var dummy = { dummy: "dummy" };
// var adapterResolved = function (value) {
//   var d = Promise.deferred();
//   d.resolve(value);
//   return d.promise;
// };



// var temp = adapterResolved(dummy);

// temp.then(undefined, function(){}).then((v) => {
//   console.log('v: ', v);
// }, undefined);