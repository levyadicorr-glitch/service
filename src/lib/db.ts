import crypto from 'crypto';
import clientPromise from './mongodb';
import { ObjectId, Document } from 'mongodb';

export interface Tenant {
  id: string; // The URL slug (e.g., 'bikeshop1')
  name: string; // Display name
  businessName?: string;
  adminPassword?: string;
  whatsappTemplate?: string;
  createdAt: string;
}

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
  toolOwnerPhone?: string;
  hasWarranty: boolean;
  warrantyReceiptImage?: string;
  toolImage?: string;
  toolImages?: string[];
  agreedToInspectionFee: boolean;
  status: 'NEW' | 'WAITING_FOR_PICKUP' | 'PICKED_UP_BY_DRIVER' | 'COMPLETED';
  createdAt: string;
  updatedAt: string;
  issueDescription?: string;
  comments?: string;
  repairLevel?: 'RIDE_ONLY' | 'SAFE_RIDE' | 'LIKE_NEW';
  preApprovedAmount?: number;
  preApprovedNotes?: string;
}

// ---------------- MongoDB Collections ----------------

export async function getMasterDb() {
  const client = await clientPromise;
  return client.db('master_db');
}

export async function getDb(tenantId: string) {
  const client = await clientPromise;
  if (!tenantId) {
    throw new Error('tenantId is required to access a tenant database');
  }
  return client.db(tenantId);
}

// ---------------- Tenant Management ----------------

const TENANT_ID_PATTERN = /^[a-z0-9]+$/;

// Guards API routes: only slugs of existing tenants may be used as database
// names, otherwise arbitrary URLs would open/create arbitrary databases.
export async function tenantExists(tenantId: string): Promise<boolean> {
  if (!tenantId || !TENANT_ID_PATTERN.test(tenantId)) return false;
  const db = await getMasterDb();
  const tenant = await db.collection('tenants').findOne({ id: tenantId }, { projection: { _id: 1 } });
  return !!tenant;
}

// adminPassword is intentionally stripped — this list is returned to the browser.
export async function getTenants(): Promise<Tenant[]> {
  const db = await getMasterDb();
  const tenants = await db.collection('tenants').find({}).toArray();
  return tenants.map(t => {
    const { _id, adminPassword, ...rest } = t;
    void adminPassword;
    return rest as Tenant;
  });
}

export async function getTenantById(id: string): Promise<Tenant | undefined> {
  const db = await getMasterDb();
  const tenant = await db.collection('tenants').findOne({ id });
  if (!tenant) return undefined;
  const { _id, ...rest } = tenant;
  return rest as Tenant;
}

export async function createTenant(tenant: Omit<Tenant, 'createdAt'>): Promise<Tenant> {
  const db = await getMasterDb();
  
  // check if exists
  const existing = await db.collection('tenants').findOne({ id: tenant.id });
  if (existing) {
    throw new Error('Tenant ID already exists');
  }

  const newTenant: Tenant = {
    ...tenant,
    createdAt: new Date().toISOString()
  };
  await db.collection('tenants').insertOne(newTenant as unknown as import('mongodb').Document);
  return newTenant;
}

export async function updateTenantAdminPassword(id: string, adminPassword: string): Promise<void> {
  const db = await getMasterDb();
  await db.collection('tenants').updateOne({ id }, { $set: { adminPassword } });
}

export async function deleteTenant(id: string): Promise<boolean> {
  const db = await getMasterDb();
  const result = await db.collection('tenants').deleteOne({ id });
  return result.deletedCount === 1;
}

// ---------------- Data Management ----------------

export async function getCustomers(tenantId: string): Promise<Customer[]> {
  const db = await getDb(tenantId);
  const customers = await db.collection('customers').find({}).toArray();
  return customers.map(c => {
    const { _id, id, ...rest } = c;
    return { id: id || _id.toString(), ...rest } as Customer;
  });
}

export async function getCustomerById(tenantId: string, id: string): Promise<Customer | undefined> {
  const db = await getDb(tenantId);
  const customer = await db.collection('customers').findOne({ id });
  if (!customer) return undefined;
  const { _id, ...rest } = customer;
  return rest as Customer;
}

export async function getServiceRequests(tenantId: string): Promise<ServiceRequest[]> {
  const db = await getDb(tenantId);
  const requests = await db.collection('serviceRequests').find({}).toArray();
  const customers = await getCustomers(tenantId);
  
  return requests.map(req => {
    const { _id, ...rest } = req;
    return {
      ...(rest as ServiceRequest),
      customer: customers.find(c => c.id === rest.customerId)
    };
  });
}

export async function createServiceRequest(
  tenantId: string,
  request: Omit<ServiceRequest, 'id' | 'requestNumber' | 'status' | 'createdAt' | 'updatedAt'> & { status?: 'NEW' | 'WAITING_FOR_PICKUP' | 'PICKED_UP_BY_DRIVER' | 'COMPLETED' }
): Promise<ServiceRequest> {
  const db = await getDb(tenantId);
  
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

  await db.collection('serviceRequests').insertOne(newRequest as unknown as import('mongodb').Document);
  return newRequest;
}

export async function updateServiceRequestStatus(
  tenantId: string,
  id: string,
  status: 'NEW' | 'WAITING_FOR_PICKUP' | 'PICKED_UP_BY_DRIVER' | 'COMPLETED'
): Promise<ServiceRequest | undefined> {
  const db = await getDb(tenantId);
  const updatedAt = new Date().toISOString();
  
  const result = await db.collection('serviceRequests').findOneAndUpdate(
    { id },
    { $set: { status, updatedAt } },
    { returnDocument: 'after' }
  );
  
  if (!result) return undefined;
  const { _id, ...rest } = result;
  return rest as unknown as ServiceRequest;
}

export async function createCustomer(
  tenantId: string,
  customer: Omit<Customer, 'id' | 'excelId'>
): Promise<Customer> {
  const db = await getDb(tenantId);

  const lastCustomer = await db.collection('customers')
    .find({}, { projection: { excelId: 1 } })
    .sort({ excelId: -1 })
    .limit(1)
    .toArray();

  let excelId = 10000;
  if (lastCustomer.length > 0 && lastCustomer[0].excelId) {
    excelId = lastCustomer[0].excelId + 1;
  }

  const newCustomer: Customer = {
    ...customer,
    id: crypto.randomUUID(),
    excelId,
  };

  await db.collection('customers').insertOne(newCustomer as unknown as import('mongodb').Document);
  return newCustomer;
}

export async function getServiceRequestsByCustomerId(tenantId: string, customerId: string): Promise<ServiceRequest[]> {
  const db = await getDb(tenantId);
  const requests = await db.collection('serviceRequests')
    .find({ customerId })
    .sort({ createdAt: -1 })
    .toArray();
  
  const customer = await getCustomerById(tenantId, customerId);
  
  return requests.map(req => {
    const { _id, ...rest } = req;
    return {
      ...(rest as ServiceRequest),
      customer: customer || undefined,
    };
  });
}

export async function getServiceRequestById(tenantId: string, id: string): Promise<ServiceRequest | undefined> {
  const db = await getDb(tenantId);
  const request = await db.collection('serviceRequests').findOne({ id });
  if (!request) return undefined;
  const { _id, ...rest } = request;
  void _id;
  return rest as unknown as ServiceRequest;
}

export async function deleteServiceRequest(tenantId: string, id: string): Promise<boolean> {
  const db = await getDb(tenantId);
  const result = await db.collection('serviceRequests').deleteOne({ id });
  return result.deletedCount === 1;
}

export async function deleteCustomer(tenantId: string, id: string): Promise<boolean> {
  const db = await getDb(tenantId);
  await db.collection('serviceRequests').deleteMany({ customerId: id });
  
  let filter = { id };
  if (ObjectId.isValid(id)) {
    filter = { $or: [{ id }, { _id: new ObjectId(id) }] } as any;
  }
  
  const result = await db.collection('customers').deleteOne(filter);
  return result.deletedCount === 1;
}
