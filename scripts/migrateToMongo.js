/* eslint-disable @typescript-eslint/no-require-imports */
const { MongoClient } = require('mongodb');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });

async function migrate() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI is missing in .env.local');
    process.exit(1);
  }

  const dbPath = path.join(__dirname, '../db.json');
  if (!fs.existsSync(dbPath)) {
    console.error('No db.json found to migrate.');
    process.exit(0);
  }

  const localData = JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
  const customers = localData.customers || [];
  const serviceRequests = localData.serviceRequests || [];

  console.log(`Found ${customers.length} customers and ${serviceRequests.length} service requests in db.json.`);

  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('Connected to MongoDB Cluster0 successfully.');

    const db = client.db('gowheels');
    
    // Customers
    if (customers.length > 0) {
      const customersCollection = db.collection('customers');
      
      // Upsert customers based on their id
      for (const customer of customers) {
        // We use $set to add all properties, but we also specify _id if we want, or just let id be a normal field.
        // It's usually easier to let MongoDB generate its own _id and keep our uuid as `id`.
        await customersCollection.updateOne(
          { id: customer.id },
          { $set: customer },
          { upsert: true }
        );
      }
      console.log('Successfully migrated customers.');
    }

    // Service Requests
    if (serviceRequests.length > 0) {
      const requestsCollection = db.collection('serviceRequests');
      for (const req of serviceRequests) {
        await requestsCollection.updateOne(
          { id: req.id },
          { $set: req },
          { upsert: true }
        );
      }
      console.log('Successfully migrated service requests.');
    }

    console.log('Migration completed successfully!');
  } catch (err) {
    console.error('Error during migration:', err);
  } finally {
    await client.close();
  }
}

migrate();
