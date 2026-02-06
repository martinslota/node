'use strict';

const common = require('../common');

if (!common.hasCrypto)
  common.skip('missing crypto');

const assert = require('assert');
const https = require('https');
const fixtures = require('../common/fixtures');

const key = fixtures.readKey('agent1-key.pem');
const cert = fixtures.readKey('agent1-cert.pem');

const server = https.createServer({ key, cert }, common.mustCall((req, res) => {
  req.on('error', common.mustNotCall());
  res.writeHead(200);
  res.end();
}, 100));

server.listen(0, common.mustCall(() => {
  const { port } = server.address();

  async function run() {
    try {
      for (let i = 0; i < 100; i++) {
        await sendRequest(port);
      }
    } finally {
      server.close();
    }
  }

  run().then(common.mustCall());
}));

function sendRequest(port) {
  let timeout;
  const promise = new Promise((resolve, reject) => {
    function done(err) {
      clearTimeout(timeout);
      if (err)
        reject(err);
      else
        resolve();
    }

    const req = https.request({
      port,
      host: '127.0.0.1',
      rejectUnauthorized: false,
      method: 'POST',
      headers: {
        'Content-Length': '0',
        Expect: '100-continue',
      },
    }, common.mustCall((res) => {
      assert.strictEqual(res.statusCode, 200);
      res.resume();
      res.once('end', done);
      res.once('error', done);
    }));

    timeout = setTimeout(() => {
      const err = new Error('request timed out');
      req.destroy(err);
      done(err);
    }, common.platformTimeout(5000));

    req.once('error', done);

    setTimeout(() => req.end(Buffer.alloc(0)), 0);
  });
  return promise.finally(() => clearTimeout(timeout));
}
