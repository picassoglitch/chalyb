import test from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { GET } from '../src/app/[locale]/(dashboard)/app/chalito/s/[sid]/route';

// The notifier's question notifications link to "/s/<sid>"; the hub's session page is /sesiones/<sid>.
const hit = (locale: string, sid: string) =>
  GET(new NextRequest(`https://www.chalyb.com/app/chalito/s/${sid}`), { params: Promise.resolve({ locale, sid }) });

test('/app/chalito/s/<sid> lands on that session page, in the same language', async () => {
  const es = await hit('es', 'ses_abc-1');
  assert.equal(es.status, 307);
  assert.equal(es.headers.get('location'), 'https://www.chalyb.com/app/chalito/sesiones/ses_abc-1');
  const en = await hit('en', 'ses_abc-1');
  assert.equal(en.headers.get('location'), 'https://www.chalyb.com/en/app/chalito/sesiones/ses_abc-1');
});

test('a malformed session id is a 404, never a redirect', async () => {
  for (const sid of ['a b', 'x'.repeat(129), '..%2F..', 'a.b']) assert.equal((await hit('es', sid)).status, 404, sid);
});
