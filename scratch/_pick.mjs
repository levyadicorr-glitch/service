import { MongoClient } from 'mongodb';
import { readFileSync } from 'node:fs';
const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split(/\r?\n/).filter(l => l.includes('='))
    .map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]));
const c = new MongoClient(env.MONGODB_URI);
await c.connect();
const db = c.db('gowheels');
const pending = await db.collection('partRequests').find({ quoteStatus: 'PENDING_APPROVAL' }).limit(3).toArray();
console.log('pending quotes:', pending.length);
for (const p of pending) {
  const cust = await db.collection('customers').findOne({ id: p.customerId });
  console.log(' req', p.requestNumber || p.id, '| price', p.quotePrice, '| cust', cust && cust.phone, cust && cust.firstName);
}
const anyCust = await db.collection('customers').find({}, { projection: { phone: 1, firstName: 1, lastName: 1 } }).limit(3).toArray();
console.log('sample customers:', anyCust.map(x => `${x.phone} ${x.firstName}`).join(' | '));
await c.close();
