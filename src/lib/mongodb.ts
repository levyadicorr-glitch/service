import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI || '';
const options = {
  maxPoolSize: 10,
  minPoolSize: 1,
};

// Cache the client on a global in every environment (not just dev). Netlify
// Functions can invoke this module in the same warm container
// across many requests, and without a global the previous code reconnected to
// MongoDB from scratch on every cold start / concurrent invocation — a major
// source of added latency and, under concurrency, connection-limit errors.
const globalWithMongo = global as typeof globalThis & {
  _mongoClientPromise?: Promise<MongoClient>;
};

function connect(): Promise<MongoClient> {
  if (!uri) throw new Error('Invalid/Missing environment variable: "MONGODB_URI"');
  const client = new MongoClient(uri, options);
  const promise = client.connect();
  // A rejected connect() must not stay cached: if a transient network hiccup
  // fails the very first connection attempt in a warm container, every request
  // handled by that container afterwards would otherwise fail forever. Clearing
  // the cache on failure lets the next call retry with a fresh connection.
  promise.catch(() => {
    if (globalWithMongo._mongoClientPromise === promise) {
      globalWithMongo._mongoClientPromise = undefined;
    }
  });
  return promise;
}

// Exported as a function (not a static promise binding) so every caller reads
// the current global reference — necessary for the retry-after-failure logic
// above to actually take effect for callers across the whole warm container.
export default function getClientPromise(): Promise<MongoClient> {
  if (!globalWithMongo._mongoClientPromise) {
    globalWithMongo._mongoClientPromise = connect();
  }
  return globalWithMongo._mongoClientPromise;
}
