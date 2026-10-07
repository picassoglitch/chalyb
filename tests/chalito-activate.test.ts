import test from 'node:test';
import assert from 'node:assert/strict';
import { ApiError, type ApiClient, type DeviceKeys } from '@chalito/client-keys';
import { CompleteRecoveryRequest, EnrollFirstClientRequest } from '@chalito/protocol';
import {
  activateFirstClient,
  canActivate,
  cleanRecoveryCode,
  needsRecovery,
  recoverWithCode,
} from '@/lib/chalito/web/activate';
import type { DirectoryRow } from '@/lib/chalito/web/endorse';
import es from '../src/lib/chalito/messages/es.json' with { type: 'json' };
import en from '../src/lib/chalito/messages/en.json' with { type: 'json' };

const OWNER = 'user-1';
const RECOVERY = 'ABCDE-FGHJK-MNPQR-STVWX-YZ0123';

const fakeApi = (
  answer: (path: string, body: unknown) => unknown,
): ApiClient & { calls: [string, unknown][] } => {
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
    deviceId = (body as { registration: { body: { deviceId: string } } }).registration.body
      .deviceId;
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
  assert.deepEqual((await run(fail(409, 'device_exists'))).r, {
    ok: false,
    reason: 'device_exists',
  });
  assert.deepEqual((await run(fail(400, 'bad_request'))).r, { ok: false, reason: 'rejected' });
  assert.deepEqual((await run(fail(503, 'error'))).r, { ok: false, reason: 'failed' });
});

test('activate: a mismatched device id from the api is a failure', async () => {
  const { r } = await run(fakeApi(() => ({ deviceId: 'dev_other', customToken: 'tok' })));
  assert.deepEqual(r, { ok: false, reason: 'failed' });
});

const row = (role: 'client' | 'agent', revoked: boolean): DirectoryRow => ({
  deviceId: `${role}-${revoked}`,
  role,
  revoked,
  pubSign: '',
  pubBox: '',
  name: '',
});

test('canActivate: only with no active device; a paired computer counts, revoked ones do not', () => {
  assert.equal(canActivate([]), true);
  assert.equal(canActivate(null), true);
  assert.equal(canActivate([row('agent', true), row('client', true)]), true);
  assert.equal(canActivate([row('agent', false)]), false);
  assert.equal(canActivate([row('client', false)]), false);
});

test('needsRecovery: no active client but an active computer', () => {
  assert.equal(needsRecovery(null), false);
  assert.equal(needsRecovery([]), false);
  assert.equal(needsRecovery([row('agent', false), row('client', true)]), true);
  assert.equal(needsRecovery([row('agent', false), row('client', false)]), false);
  assert.equal(needsRecovery([row('agent', true)]), false);
});

test('activate: an account with a paired computer gets has_agents', async () => {
  const { r } = await run(
    fakeApi(() => {
      throw new ApiError(409, 'agent_exists');
    }),
  );
  assert.deepEqual(r, { ok: false, reason: 'has_agents' });
});

const OLD_CODE = 'ZZZZZ-YYYYY-XXXXX-WWWWW-VVVVV0';

test('cleanRecoveryCode: upper case, no spaces, and only the right shape', () => {
  assert.equal(cleanRecoveryCode(' abcde-fghjk-mnpqr-stvwx-yz0123 '), RECOVERY);
  assert.equal(cleanRecoveryCode('ABCDE-FGHJK-MNPQR-STVWX-YZ012'), null);
  assert.equal(cleanRecoveryCode(''), null);
});

const recover = async (api: ApiClient) => {
  const saved: DeviceKeys[] = [];
  const r = await recoverWithCode(
    {
      api,
      save: async (k) => void saved.push(k),
      owner: OWNER,
      name: 'Chrome en Mac',
      recoveryCode: async () => RECOVERY,
    },
    OLD_CODE,
  );
  return { r, saved };
};

test('recover: after the cool-down it enrols this browser with a NEW code, without restarting it', async () => {
  const api = fakeApi((path, body) => {
    assert.equal(path, '/v1/recovery/complete');
    return {
      deviceId: (body as { registration: { body: { deviceId: string } } }).registration.body
        .deviceId,
      customToken: 'tok',
    };
  });
  const { r, saved } = await recover(api);
  assert.equal(api.calls.length, 1);
  const req = CompleteRecoveryRequest.parse(api.calls[0]![1]);
  assert.equal(req.recoveryCode, OLD_CODE);
  assert.equal(req.newRecoveryCode, RECOVERY);
  assert.equal(req.registration.body.kind, 'web');
  assert.deepEqual(r, {
    ok: true,
    deviceId: saved[0]!.deviceId,
    customToken: 'tok',
    recoveryCode: RECOVERY,
  });
});

test('recover: not started or still cooling down starts it and returns when this browser can come in', async () => {
  for (const [status, code] of [
    [409, 'recovery_not_started'],
    [425, 'cooldown'],
  ] as const) {
    const api = fakeApi((path) => {
      if (path === '/v1/recovery/complete') throw new ApiError(status, code);
      assert.equal(path, '/v1/recovery/start');
      return { cooldownUntil: 123_456 };
    });
    const { r } = await recover(api);
    assert.deepEqual(r, { ok: false, reason: 'cooldown', until: 123_456 });
    assert.deepEqual(api.calls[1], ['/v1/recovery/start', { recoveryCode: OLD_CODE }]);
  }
});

test('recover: a wrong code never starts a cool-down', async () => {
  const api = fakeApi(() => {
    throw new ApiError(401, 'bad_code');
  });
  const { r } = await recover(api);
  assert.deepEqual(r, { ok: false, reason: 'bad_code' });
  assert.equal(api.calls.length, 1);
  assert.deepEqual(
    (
      await recover(
        fakeApi(() => {
          throw new ApiError(400, 'bad_request');
        }),
      )
    ).r,
    { ok: false, reason: 'rejected' },
  );
});

test('activate: es and en have the same strings', () => {
  const keys = (o: object, p = ''): string[] =>
    Object.entries(o).flatMap(([k, v]) =>
      typeof v === 'object' ? keys(v, `${p}${k}.`) : [`${p}${k}`],
    );
  assert.deepEqual(keys(es.live.activate).sort(), keys(en.live.activate).sort());
  assert.deepEqual(keys(es.live.recover).sort(), keys(en.live.recover).sort());
  assert.ok(es.endorse.wait.lostDevice && en.endorse.wait.lostDevice);
});
