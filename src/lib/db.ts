import crypto from 'crypto';
import clientPromise from './mongodb';
import { ObjectId, Document } from 'mongodb';

export interface Customer {
  id: string;
  excelId: number;
  firstName: string;
  lastName: string;
  phone?: string;
  email?: string;
  address?: string;
  licensePlate?: string;
  color?: string;
  serialNumber?: string;
}

export interface ServiceRequest {
  id: string;
  requestNumber: number;
  customerId: string;
  customer?: Customer;
  storeName: string;
  toolOwnerName: string;
  hasWarranty: boolean;
  warrantyReceiptImage?: string;
  toolImage?: string;
  toolImages?: string[];
  agreedToInspectionFee: boolean;
  status: 'NEW' | 'WAITING_FOR_PICKUP' | 'PICKED_UP_BY_DRIVER';
  createdAt: string;
  updatedAt: string;
}

// ---------------- MongoDB Collections ----------------
async function getDb() {
  const client = await clientPromise;
  return client.db('gowheels');
}

export async function getCustomers(): Promise<Customer[]> {
  const db = await getDb();
  // Fetch from Mongo and remove the internal _id
  const customers = await db.collection('customers').find({}).toArray();
  return customers.map(c => {
    const { _id, ...rest } = c;
    return rest as Customer;
  });
}

export async function getCustomerById(id: string): Promise<Customer | undefined> {
  const db = await getDb();
  const customer = await db.collection('customers').findOne({ id });
  if (!customer) return undefined;
  const { _id, ...rest } = customer;
  return rest as Customer;
}

export async function getServiceRequests(): Promise<ServiceRequest[]> {
  const db = await getDb();
  const requests = await db.collection('serviceRequests').find({}).toArray();
  const customers = await getCustomers();
  
  return requests.map(req => {
    const { _id, ...rest } = req;
    return {
      ...(rest as ServiceRequest),
      customer: customers.find(c => c.id === rest.customerId)
    };
  });
}

export async function createServiceRequest(
  request: Omit<ServiceRequest, 'id' | 'requestNumber' | 'status' | 'createdAt' | 'updatedAt'> & { status?: 'NEW' | 'WAITING_FOR_PICKUP' | 'PICKED_UP_BY_DRIVER' }
): Promise<ServiceRequest> {
  const db = await getDb();
  
  // Find highest request number
  const lastRequest = await db.collection('serviceRequests')
    .find({}, { projection: { requestNumber: 1 } })
    .sort({ requestNumber: -1 })
    .limit(1)
    .toArray();
    
  let requestNumber = 1000;
  if (lastRequest.length > 0 && lastRequest[0].requestNumber) {
    requestNumber = lastRequest[0].requestNumber + 1;
  }
  
  const newRequest: ServiceRequest = {
    ...request,
    id: crypto.randomUUID(),
    requestNumber,
    status: request.status || 'NEW',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  await db.collection('serviceRequests').insertOne(newRequest as Record<string, unknown>);
  return newRequest;
}

export async function updateServiceRequestStatus(
  id: string,
  status: 'NEW' | 'WAITING_FOR_PICKUP' | 'PICKED_UP_BY_DRIVER'
): Promise<ServiceRequest | undefined> {
  const db = await getDb();
  
  const updatedAt = new Date().toISOString();
  
  const result = await db.collection('serviceRequests').findOneAndUpdate(
    { id },
    { $set: { status, updatedAt } },
    { returnDocument: 'after' }
  );
  
  if (!result) {
    return undefined;
  }
  
  const { _id, ...rest } = result;
  return rest as unknown as ServiceRequest;
}
