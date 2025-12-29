// window に載せるのが重要
window.InitManager = (() => {
  const handlers = new Map();
  const fired = new Set();

  function register(phase, fn) {
    if (!handlers.has(phase)) {
      handlers.set(phase, []);
    }
    handlers.get(phase).push(fn);

    // すでに発火済みなら即実行
    if (fired.has(phase)) {
      fn(window.__initContext);
    }
  }

  async function run(phase, context = {}) {
    window.__initContext = context;
    fired.add(phase);

    const list = handlers.get(phase) || [];
    for (const fn of list) {
      await fn(context);
    }
  }

  return { register, run };
})();
