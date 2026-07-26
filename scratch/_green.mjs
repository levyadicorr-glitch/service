// READ-ONLY: reports what the gowheels Green API instance currently has registered.
import { MongoClient } from 'mongodb';
import { readFileSync } from 'node:fs';

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split(/\r?\n/).filter(l => l.includes('='))
    .map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()])
);

const client = new MongoClient(env.MONGODB_URI);
await client.connect();
const t = await client.db('master_db').collection('tenants').findOne({ id: 'gowheels' });
await client.close();

const { greenApiInstanceId: id, greenApiToken: token } = t;

for (const ep of ['getStateInstance', 'getSettings']) {
  const res = await fetch(`https://api.green-api.com/waInstance${id}/${ep}/${token}`);
  const body = await res.json().catch(() => null);
  console.log(`\n=== ${ep} (HTTP ${res.status}) ===`);
  if (!body) { console.log('(no JSON body)'); continue; }
  // Redact the token if it appears anywhere in the response.
  console.log(JSON.stringify(body, null, 2).replaceAll(token, '<TOKEN>'));
}
