import crypto from 'crypto';
import clientPromise from './mongodb';
import { ObjectId, Document } from 'mongodb';

export interface Tenant {
  id: string; // The URL slug (e.g., 'bikeshop1')
  name: string; // Display name
  businessName?: string;
  adminPassword?: string;
  adminPasswordPlain?: string;
  whatsappTemplate?: string;
  logoUrl?: string;
  primaryColor?: string;
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
  logoUrl?: string;
}

export interface Driver {
  id: string; // uuid — also serves as the secret token for the driver's panel link
  name: string;
  phone?: string;
  createdAt: string;
}

export interface ServiceRequest {
  id: string;
  requestNumber: number;
  customerId: string;
  customer?: Customer;
  driverId?: string;
  driver?: Driver;
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
  pickupSignatureImage?: string;
  pickupPhotoImage?: string;
  pickupSignerName?: string;
  pickupSignedAt?: string;
  pickupConditionNotes?: string;
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

// Index creation only needs to happen once per tenant per warm server process —
// running it on every request added 6 blocking round-trips to MongoDB per request.
const indexedTenants = new Set<string>();

export async function ensureIndexes(tenantId: string) {
  if (indexedTenants.has(tenantId)) return;
  const db = await getDb(tenantId);
  await Promise.all([
    db.collection('customers').createIndex({ id: 1 }, { unique: true }),
    db.collection('serviceRequests').createIndex({ id: 1 }, { unique: true }),
    db.collection('serviceRequests').createIndex({ customerId: 1 }),
    db.collection('serviceRequests').createIndex({ requestNumber: -1 }),
    db.collection('serviceRequests').createIndex({ driverId: 1 }),
    db.collection('drivers').createIndex({ id: 1 }, { unique: true }),
  ]);
  indexedTenants.add(tenantId);
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
    const { _id, adminPassword, adminPasswordPlain, ...rest } = t;
    void adminPassword;
    void adminPasswordPlain;
    return rest as Tenant;
  });
}

// SUPADMIN ONLY: includes the viewable adminPasswordPlain; the scrypt hash is projected out.
export async function getTenantsWithPasswords(): Promise<Tenant[]> {
  const db = await getMasterDb();
  const tenants = await db.collection('tenants')
    .find({}, { projection: { _id: 0, adminPassword: 0 } })
    .toArray();
  return tenants as unknown as Tenant[];
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

export async function updateTenantAdminPassword(id: string, adminPassword: string, adminPasswordPlain?: string): Promise<void> {
  const db = await getMasterDb();
  await db.collection('tenants').updateOne(
    { id },
    { $set: { adminPassword, ...(adminPasswordPlain !== undefined ? { adminPasswordPlain } : {}) } }
  );
}

export async function updateTenantSettings(
  id: string,
  update: { name?: string; businessName?: string; logoUrl?: string; adminPassword?: string; adminPasswordPlain?: string; whatsappTemplate?: string }
): Promise<void> {
  const db = await getMasterDb();
  const setObj: Record<string, any> = {};
  if (update.businessName !== undefined) {
    setObj.name = update.businessName;
    setObj.businessName = update.businessName;
  }
  if (update.whatsappTemplate !== undefined) setObj.whatsappTemplate = update.whatsappTemplate;
  if (update.logoUrl !== undefined) setObj.logoUrl = update.logoUrl;
  if (update.adminPassword !== undefined) setObj.adminPassword = update.adminPassword;
  if (update.adminPasswordPlain !== undefined) setObj.adminPasswordPlain = update.adminPasswordPlain;
  
  if (Object.keys(setObj).length > 0) {
    await db.collection('tenants').updateOne({ id }, { $set: setObj });
  }
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

// ---------------- Drivers ----------------

export async function getDrivers(tenantId: string): Promise<Driver[]> {
  const db = await getDb(tenantId);
  const drivers = await db.collection('drivers').find({}).sort({ createdAt: 1 }).toArray();
  return drivers.map(d => {
    const { _id, ...rest } = d;
    void _id;
    return rest as unknown as Driver;
  });
}

export async function getDriverById(tenantId: string, id: string): Promise<Driver | undefined> {
  const db = await getDb(tenantId);
  const driver = await db.collection('drivers').findOne({ id });
  if (!driver) return undefined;
  const { _id, ...rest } = driver;
  void _id;
  return rest as unknown as Driver;
}

export async function createDriver(
  tenantId: string,
  driver: Omit<Driver, 'id' | 'createdAt'>
): Promise<Driver> {
  const db = await getDb(tenantId);
  const newDriver: Driver = {
    ...driver,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  };
  await db.collection('drivers').insertOne(newDriver as unknown as Document);
  return newDriver;
}

export async function updateDriver(
  tenantId: string,
  id: string,
  update: Partial<Omit<Driver, 'id' | 'createdAt'>>
): Promise<boolean> {
  const db = await getDb(tenantId);
  const result = await db.collection('drivers').updateOne({ id }, { $set: update });
  return result.matchedCount === 1;
}

export async function deleteDriver(tenantId: string, id: string): Promise<boolean> {
  const db = await getDb(tenantId);
  // Requests assigned to this driver become unassigned, never deleted.
  await db.collection('serviceRequests').updateMany(
    { driverId: id },
    { $unset: { driverId: '' }, $set: { updatedAt: new Date().toISOString() } }
  );
  const result = await db.collection('drivers').deleteOne({ id });
  return result.deletedCount === 1;
}

export async function assignDriverToRequest(
  tenantId: string,
  requestId: string,
  driverId: string | null
): Promise<ServiceRequest | undefined> {
  const db = await getDb(tenantId);
  const updatedAt = new Date().toISOString();
  const update = driverId
    ? { $set: { driverId, updatedAt } }
    : { $set: { updatedAt }, $unset: { driverId: '' } };
  const result = await db.collection('serviceRequests').findOneAndUpdate(
    { id: requestId },
    update,
    { returnDocument: 'after' }
  );
  if (!result) return undefined;
  const { _id, ...rest } = result;
  void _id;
  return rest as unknown as ServiceRequest;
}

export async function getServiceRequestsByDriverId(tenantId: string, driverId: string): Promise<ServiceRequest[]> {
  const db = await getDb(tenantId);
  const requests = await db.collection('serviceRequests')
    .find({ driverId }, { projection: { toolImages: 0, toolImage: 0, warrantyReceiptImage: 0, pickupSignatureImage: 0, pickupPhotoImage: 0 } })
    .sort({ createdAt: -1 })
    .toArray();

  const customers = await getCustomers(tenantId);

  return requests.map(req => {
    const { _id, ...rest } = req;
    void _id;
    return {
      ...(rest as unknown as ServiceRequest),
      customer: customers.find(c => c.id === rest.customerId),
    };
  });
}

export async function getServiceRequests(tenantId: string): Promise<ServiceRequest[]>;
export async function getServiceRequests(tenantId: string, options: { 
  page?: number; 
  limit?: number; 
  excludeImages?: boolean; 
}): Promise<{ requests: ServiceRequest[]; total: number }>;
export async function getServiceRequests(tenantId: string, options?: { 
  page?: number; 
  limit?: number; 
  excludeImages?: boolean; 
}): Promise<any> {
  const db = await getDb(tenantId);
  
  const page = options?.page || 1;
  const limit = options?.limit || 100;
  const skip = (page - 1) * limit;
  const excludeImages = options?.excludeImages || false;

  const projection: any = {};
  if (excludeImages) {
    projection.toolImages = 0;
    projection.toolImage = 0;
    projection.warrantyReceiptImage = 0;
    projection.pickupSignatureImage = 0;
    projection.pickupPhotoImage = 0;
  }

  const cursor = db.collection('serviceRequests').find({}, { projection })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  // These four queries are independent — running them in parallel instead of
  // sequentially avoids paying round-trip latency to MongoDB Atlas four times over.
  const [requests, total, customers, drivers] = await Promise.all([
    cursor.toArray(),
    db.collection('serviceRequests').countDocuments({}),
    getCustomers(tenantId),
    getDrivers(tenantId),
  ]);

  const mappedRequests = requests.map(req => {
    const { _id, ...rest } = req;
    return {
      ...(rest as ServiceRequest),
      customer: customers.find(c => c.id === rest.customerId),
      driver: rest.driverId ? drivers.find(d => d.id === rest.driverId) : undefined
    };
  });

  if (!options) {
    return mappedRequests;
  }
  
  return { requests: mappedRequests, total };
}

export async function createServiceRequest(
  tenantId: string,
  request: Omit<ServiceRequest, 'id' | 'requestNumber' | 'status' | 'createdAt' | 'updatedAt'> & { status?: 'NEW' | 'WAITING_FOR_PICKUP' | 'PICKED_UP_BY_DRIVER' | 'COMPLETED' }
): Promise<ServiceRequest> {
  const db = await getDb(tenantId);
  
  const counterResult = await db.collection('counters').findOneAndUpdate(
    { _id: 'requestNumber' as any },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: 'after' }
  );
  const requestNumber = counterResult?.seq || 1;

  // When the tenant has exactly one driver, every new request is auto-assigned to him.
  let driverId = request.driverId;
  if (!driverId) {
    const drivers = await getDrivers(tenantId);
    if (drivers.length === 1) driverId = drivers[0].id;
  }

  const newRequest: ServiceRequest = {
    ...request,
    ...(driverId ? { driverId } : {}),
    id: crypto.randomUUID(),
    requestNumber,
    status: request.status || 'NEW',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  await db.collection('serviceRequests').insertOne(newRequest as unknown as import('mongodb').Document);
  return newRequest;
}

export async function markRequestsPickedUpWithSignature(
  tenantId: string,
  requestIds: string[],
  driverId: string,
  data: { 
    signatureImage: string; 
    photoImage?: string; 
    signerName: string;
    conditionNotesMap?: Record<string, string>;
  }
): Promise<number> {
  const db = await getDb(tenantId);
  const now = new Date().toISOString();
  
  let modifiedCount = 0;
  for (const id of requestIds) {
    const notes = data.conditionNotesMap?.[id] || '';
    const result = await db.collection('serviceRequests').updateOne(
      { id, driverId },
      {
        $set: {
          status: 'PICKED_UP_BY_DRIVER',
          pickupSignatureImage: data.signatureImage,
          ...(data.photoImage ? { pickupPhotoImage: data.photoImage } : {}),
          pickupSignerName: data.signerName,
          pickupSignedAt: now,
          pickupConditionNotes: notes,
          updatedAt: now,
        },
      }
    );
    modifiedCount += result.modifiedCount;
  }
  return modifiedCount;
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

export async function updateCustomer(
  tenantId: string,
  id: string,
  update: Partial<Omit<Customer, 'id' | 'excelId'>>
): Promise<boolean> {
  const db = await getDb(tenantId);
  const result = await db.collection('customers').updateOne(
    { id },
    { $set: update }
  );
  return result.matchedCount === 1;
}
