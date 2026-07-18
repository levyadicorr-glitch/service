import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI || '';
const options = {
  maxPoolSize: 10,
  minPoolSize: 1,
};

// Cache the client on a global in every environment (not just dev). Serverless
// platforms (Netlify/Vercel) can invoke this module in the same warm container
// across many requests, and without a global the previous code reconnected to
// MongoDB from scratch on every cold start / concurrent invocation — a major
// source of added latency and, under concurrency, connection-limit errors.
const globalWithMongo = global as typeof globalThis & {
  _mongoClientPromise?: Promise<MongoClient>;
};

if (!globalWithMongo._mongoClientPromise) {
  if (!uri) throw new Error('Invalid/Missing environment variable: "MONGODB_URI"');
  const client = new MongoClient(uri, options);
  globalWithMongo._mongoClientPromise = client.connect();
}

// Export a module-scoped MongoClient promise. By doing this in a
// separate module, the client can be shared across functions.
const clientPromise = globalWithMongo._mongoClientPromise;
export default clientPromise;
