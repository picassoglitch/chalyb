import test from 'node:test';
import assert from 'node:assert/strict';
import { ApiError, type ApiClient, type DeviceKeys } from '@chalito/client-keys';
import { EnrollFirstClientRequest } from '@chalito/protocol';
import { activateFirstClient, canActivate } from '@/lib/chalito/web/activate';
import type { DirectoryRow } from '@/lib/chalito/web/endorse';
import es from '../src/lib/chalito/messages/es.json' with { type: 'json' };
import en from '../src/lib/chalito/messages/en.json' with { type: 'json' };

const OWNER = 'user-1';
const RECOVERY = 'ABCDE-FGHJK-MNPQR-STVWX-YZ0123';

const fakeApi = (answer: (path: string, body: unknown) => unknown): ApiClient & { calls: [string, unknown][] } => {
  const calls: [string, unknown][] = [];
  return {
    calls,
    async post<T>(path: string, body: unknown): Promise<T> {
      calls.push([path, body]);
      return answer(path, body) as T;
    },
  };
};

const run = async (api: ApiClient) => {
  const saved: DeviceKeys[] = [];
  const r = await activateFirstClient({
    api,
    save: async (k) => void saved.push(k),
    owner: OWNER,
    name: 'Chrome en Mac',
    recoveryCode: async () => RECOVERY,
  });
  return { r, saved };
};

test('activate: saves a fresh identity, posts a valid first-client request and returns the recovery code', async () => {
  let deviceId = '';
  const api = fakeApi((_p, body) => {
    deviceId = (body as { registration: { body: { deviceId: string } } }).registration.body.deviceId;
    return { deviceId, customToken: 'tok' };
  });
  const { r, saved } = await run(api);
  assert.equal(api.calls.length, 1);
  assert.equal(api.calls[0]![0], '/v1/devices/first');
  const req = EnrollFirstClientRequest.parse(api.calls[0]![1]);
  assert.equal(req.registration.body.owner, OWNER);
  assert.equal(req.registration.body.kind, 'web');
  assert.equal(req.recoveryCode, RECOVERY);
  assert.equal(saved.length, 1);
  assert.equal(saved[0]!.deviceId, deviceId);
  assert.deepEqual(r, { ok: true, deviceId, customToken: 'tok', recoveryCode: RECOVERY });
  // Only public keys leave the browser.
  assert.ok(!JSON.stringify(api.calls).includes('secretKey'));
});

test('activate: an account with a client gets has_clients (the api decides)', async () => {
  const { r } = await run(
    fakeApi(() => {
      throw new ApiError(409, 'client_exists');
    }),
  );
  assert.deepEqual(r, { ok: false, reason: 'has_clients' });
});

test('activate: maps other api errors', async () => {
  const fail = (status: number, code: string) =>
    fakeApi(() => {
      throw new ApiError(status, code);
    });
  assert.deepEqual((await run(fail(409, 'device_exists'))).r, { ok: false, reason: 'device_exists' });
  assert.deepEqual((await run(fail(400, 'bad_request'))).r, { ok: false, reason: 'rejected' });
  assert.deepEqual((await run(fail(503, 'error'))).r, { ok: false, reason: 'failed' });
});

test('activate: a mismatched device id from the api is a failure', async () => {
  const { r } = await run(fakeApi(() => ({ deviceId: 'dev_other', customToken: 'tok' })));
  assert.deepEqual(r, { ok: false, reason: 'failed' });
});

test('canActivate: only with no active client; agents and revoked clients do not count', () => {
  const row = (role: 'client' | 'agent', revoked: boolean): DirectoryRow => ({
    deviceId: `${role}-${revoked}`,
    role,
    revoked,
    pubSign: '',
    pubBox: '',
    name: '',
  });
  assert.equal(canActivate([]), true);
  assert.equal(canActivate(null), true);
  assert.equal(canActivate([row('agent', false), row('client', true)]), true);
  assert.equal(canActivate([row('client', false)]), false);
});

test('activate: es and en have the same strings', () => {
  const keys = (o: object, p = ''): string[] =>
    Object.entries(o).flatMap(([k, v]) => (typeof v === 'object' ? keys(v, `${p}${k}.`) : [`${p}${k}`]));
  assert.deepEqual(keys(es.live.activate).sort(), keys(en.live.activate).sort());
});
