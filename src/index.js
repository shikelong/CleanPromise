
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
  #callbacks = [];

  constructor(executor) {

    const self = this;

    if (!isFunction(executor)) {
      throw new Error("Promise constructor's argument must be a function.")
    }

    self.#status = _STATUS.pending;

    function resolve(value) {
      if (self.#status === _STATUS.pending) {

        globalThis.queueMicrotask(() => {
          self.#value = value;
          self.#status = _STATUS.fulfilled;
          self.#callbacks.forEach(callback => callback.onFulfilled(self.#value))
        })
      }
    }

    function reject(error) {
      if (self.#status === _STATUS.pending) {

        globalThis.queueMicrotask(() => {
          self.#value = error;
          self.#status = _STATUS.rejected;
          self.#callbacks.forEach(callback => callback.onRejected(self.#value))
        })
      }
    }

    try {
      executor(resolve, reject);
    } catch (e) {
      reject(e);
    }

  }

  then(onFulfilled, onRejected) {

    if (!isFunction(onFulfilled)) {
      onFulfilled = v => v;
    }
    if (!isFunction(onRejected)) {
      onRejected = err => {throw err};
    }

    let newPromise, self = this;

    //avoid repeat code
    function excuteChildProcess(value, onDone, resolve, reject, newPromise) {
      try {
        let result = onDone(value);
        resolver(newPromise, result, resolve, reject);
      } catch (e) {
        reject(e);
      }
    }


    //The promise resolution procedure
    function resolver(newPromise, x, resolve, reject) {
      if (newPromise === x) {
        return reject(new TypeError("new promise cannot be equal with x"));
      }

      let hasSettled = false;

      if (x instanceof Promise) {
        if (x.#status === _STATUS.pending) {
          x.then((v) => resolver(newPromise, v, resolve, reject), reject);
        } else {
          x.then(resolve, reject);
        }
      } else if (x !== null && (isFunction(x) || typeof x === "object")) {
        try {
          let then = x.then;
          if (isFunction(then)) {
            then.call(x, (y) => {
              if (hasSettled) {
                return;
              }
              hasSettled = true;
              return resolver(newPromise, y, resolve, reject);
            }, (reason) => {
              if (hasSettled) {
                return;
              }
              hasSettled = true;
              return reject(reason);
            });
          } else {
            return resolve(x);
          }
        } catch (e) {
          if (hasSettled) {
            return;
          }
          hasSettled = true;
          return reject(e);
        }

      } else {
        return resolve(x);
      }
    }

    switch (this.#status) {
      case _STATUS.pending:
        newPromise = new Promise((resolve, reject) => {
          this.#callbacks.push({
            onFulfilled: (value) => excuteChildProcess(value, onFulfilled, resolve, reject, newPromise),
            onRejected: (value) => excuteChildProcess(value, onRejected, resolve, reject, newPromise)
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
          global.queueMicrotask(() => excuteChildProcess(this.#value, onRejected, resolve, reject, newPromise))
        });
        break;
    }

    return newPromise;

  }

  catch(onRejected) {
    return this.then(null, onRejected);
  }

  finally(onFinally) {
    //TODO
  }

  static resolve(value) {
    return new Promise((resolve, reject) => {
      resolve(value);
    });
  }

  static reject(error) {
    return new Promise((resolve, reject) => {
      reject(error);
    });
  }

  static race(promises) {
    return new Promise((resolve, reject) => {
      for (let i = 0; i < promises.length; i++) {
        const promise = promises[i];
        promise.then((value) => {
          resolve(value);
        }, (reason) => {
          reject(reason);
        });
      }
    });
  }

  static all(promises) {
    let fulfilledCounts = 0;
    const promisesCount = promises.length;
    return new Promise((resolve, reject) => {
      const values = new Array(promisesCount);
    
      for (let i = 0; i < promisesCount; i++) {
        const promise = promises[i];
        promise.then((value) => {
          values[i] = value;
          if (++fulfilledCounts === promisesCount){
            resolve(values);
          }
        }, (reason) => {
          reject(reason);
        });
      }
    });
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
