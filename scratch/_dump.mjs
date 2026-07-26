import { MongoClient } from 'mongodb';

const uri = 'mongodb+srv://adi050levy_db_user:mc6KiMR1apAsvaHc@cluster0.xhavxfi.mongodb.net/?appName=Cluster0';

async function main() {
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db('gowheels');

  const tenant = await db.collection('tenants').findOne({ id: 'gowheels' });
  console.log('--- TENANT CONFIG ---');
  console.log('name:', tenant?.name, 'businessName:', tenant?.businessName);
  console.log('aiBotConfig:', JSON.stringify(tenant?.aiBotConfig, null, 2));
  console.log('Green API:', tenant?.greenApiInstanceId, tenant?.greenApiToken ? 'HAS TOKEN' : 'NO TOKEN');

  const customers = await db.collection('customers').find({}).toArray();
  console.log('\n--- CUSTOMERS ---', customers.length);
  customers.forEach(c => console.log(`[Customer] id=${c.id} name=${c.firstName} ${c.lastName} phone=${c.phone}`));

  const parts = await db.collection('partRequests').find({}).toArray();
  console.log('\n--- PART REQUESTS ---', parts.length);
  parts.forEach(p => console.log(`[PartRequest] id=${p.id} customerId=${p.customerId} status=${p.quoteStatus} price=${p.quotePrice} desc=${p.description} sentAt=${p.quoteSentAt}`));

  const msgs = await db.collection('botConversations').find({}).sort({ timestamp: -1 }).limit(10).toArray();
  console.log('\n--- RECENT MESSAGES ---', msgs.length);
  msgs.forEach(m => console.log(`[Msg] time=${m.timestamp} source=${m.source} phone=${m.phone} text="${m.text}" delivered=${m.delivered} error=${m.error}`));

  await client.close();
}

main().catch(console.error);
