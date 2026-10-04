// The mock adapters' side of the BFF timeout (TOOLS-SPEC §1.2): every I/O
// method takes an optional AbortSignal as its last argument. The mocks do no
// real I/O, so they only honor it: an already-aborted signal throws a
// ToolTimeoutError, and a call is deferred by one tick so a signal aborted
// before the call gets to run stops it before anything is written.

import { ToolTimeoutError } from '../bff-core';

function signalIn(args: unknown[]): AbortSignal | undefined {
  return args.find((x): x is AbortSignal => x instanceof AbortSignal);
}

export function honorSignal<A extends object>(adapter: A): A {
  return new Proxy(adapter, {
    get(target, prop, receiver) {
      const v = Reflect.get(target, prop, receiver);
      if (typeof v !== 'function') return v;
      return (...args: unknown[]) => {
        const signal = signalIn(args);
        if (!signal) return (v as (...a: unknown[]) => unknown).apply(target, args);
        if (signal.aborted) return Promise.reject(new ToolTimeoutError('aborted'));
        return Promise.resolve().then(() => {
          if (signal.aborted) throw new ToolTimeoutError('aborted');
          return (v as (...a: unknown[]) => unknown).apply(target, args);
        });
      };
    },
  });
}
