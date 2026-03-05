const assert = require('assert');
const express = require('express');

const enableAsyncHandler = require('../middleware/enable-async-handler');
const errorMiddleware = require('../middleware/error-handler');

enableAsyncHandler(express);

async function run() {
    const app = express();

    app.get('/boom', async () => {
        throw new Error('async fail test');
    });

    app.use(errorMiddleware);

    const server = app.listen(0);

    try {
        const address = server.address();
        const url = `http://127.0.0.1:${address.port}/boom`;
        const response = await fetch(url);
        const body = await response.json();

        assert.strictEqual(response.status, 500, 'Expected HTTP 500 for async route throw');
        assert.strictEqual(body.code, 'INTERNAL_ERROR', 'Expected normalized internal error code');
        assert.ok(typeof body.error === 'string' && body.error.length > 0, 'Expected user-facing error message');

        console.log('PASS: async route errors are forwarded to JSON 500 middleware responses.');
    } finally {
        await new Promise((resolve, reject) => {
            server.close((err) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve();
            });
        });
    }
}

run().catch((err) => {
    console.error('FAIL:', err.message);
    process.exitCode = 1;
});
