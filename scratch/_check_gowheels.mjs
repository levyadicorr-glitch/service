process.env.MONGODB_URI = 'mongodb+srv://adi050levy_db_user:mc6KiMR1apAsvaHc@cluster0.xhavxfi.mongodb.net/?appName=Cluster0';
import { getTenantById } from '../src/lib/db.ts';
import getClientPromise from '../src/lib/mongodb.ts';

async function main() {
  const tenant = await getTenantById('gowheels');
  console.log('Tenant gowheels:', tenant?.name, tenant?.businessName);
  console.log('aiBotConfig:', JSON.stringify(tenant?.aiBotConfig, null, 2));
  console.log('Green API:', tenant?.greenApiInstanceId, tenant?.greenApiToken ? 'HAS TOKEN' : 'NO TOKEN');
  
  const client = await getClientPromise();
  const db = client.db('gowheels');

  const customers = await db.collection('customers').find({}).toArray();
  console.log('\n--- Customers ---', customers.length);
  customers.forEach(c => console.log('Customer:', c.id, c.firstName, c.lastName, c.phone));
  
  const parts = await db.collection('partRequests').find({}).toArray();
  console.log('\n--- Part Requests ---', parts.length);
  parts.forEach(p => console.log('PartRequest:', p.id, p.customerId, 'Status:', p.quoteStatus, 'Price:', p.quotePrice, 'SentAt:', p.quoteSentAt));

  const msgs = await db.collection('botConversations').find({}).sort({ timestamp: -1 }).limit(10).toArray();
  console.log('\n--- Recent Bot Conversations ---', msgs.length);
  msgs.forEach(m => console.log('Msg:', m.timestamp, m.source, m.phone, m.text, 'Delivered:', m.delivered, 'Error:', m.error));
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
