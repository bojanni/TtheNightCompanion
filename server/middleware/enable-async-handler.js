const asyncHandler = require('./async-handler');

const METHODS_TO_PATCH = ['use', 'all', 'get', 'post', 'put', 'patch', 'delete', 'options', 'head'];

let isEnabled = false;

function isPathLike(value) {
    return typeof value === 'string' || value instanceof RegExp || Array.isArray(value);
}

function isAsyncFunction(value) {
    return typeof value === 'function' && value.constructor && value.constructor.name === 'AsyncFunction';
}

function wrapHandler(handler) {
    if (Array.isArray(handler)) {
        return handler.map(wrapHandler);
    }

    if (typeof handler !== 'function') {
        return handler;
    }

    // Keep error handlers unchanged (err, req, res, next).
    if (handler.length === 4) {
        return handler;
    }

    if (isAsyncFunction(handler)) {
        return asyncHandler(handler);
    }

    return handler;
}

function wrapArgs(args) {
    return args.map((arg, index) => {
        if (index === 0 && isPathLike(arg)) {
            return arg;
        }

        return wrapHandler(arg);
    });
}

function patchMethod(target, method) {
    const original = target[method];
    if (typeof original !== 'function' || original.__asyncHandlerPatched) {
        return;
    }

    function patchedMethod(...args) {
        return original.apply(this, wrapArgs(args));
    }

    patchedMethod.__asyncHandlerPatched = true;
    target[method] = patchedMethod;
}

function enableAsyncHandler(express) {
    if (isEnabled) {
        return;
    }

    isEnabled = true;

    const appPrototype = express.application;
    const routerPrototype = Object.getPrototypeOf(express.Router());

    METHODS_TO_PATCH.forEach((method) => {
        patchMethod(appPrototype, method);
        patchMethod(routerPrototype, method);
    });
}

module.exports = enableAsyncHandler;
