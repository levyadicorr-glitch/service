import crypto from 'crypto';
import getClientPromise from './mongodb';
import { ObjectId, Document } from 'mongodb';
import type { ServiceFormConfig } from './serviceFormConfig';
import type { AiBotConfig } from './aiBotConfig';

export interface SpecificModel {
  name: string;
  deviceType: string;
}

export interface Tenant {
  id: string; // The URL slug (e.g., 'bikeshop1')
  name: string; // Display name
  businessName?: string;
  adminPassword?: string;
  adminPasswordPlain?: string;
  whatsappTemplate?: string;
  logoUrl?: string;
  primaryColor?: string;
  partsRequestPhone?: string;
  partsDeletePassword?: string;
  adminWhatsappPhone?: string;
  adminWhatsappPhone2?: string;
  adminWhatsappPhone3?: string;
  quoteNotificationPhones?: string; // Comma-separated list of phones for quote approvals
  chinaOrderNotificationPhones?: string; // Comma-separated phones notified when a China part is marked ORDERED
  testApprovalPrice?: number; // Default price (₪) for a new test/inspection approval request
  // Up to 4 dedicated numbers notified when a customer approves a test/inspection
  // request — separate from quoteNotificationPhones so this module's recipients
  // don't have to match the part-request quote recipients.
  testApprovalPhone1?: string;
  testApprovalPhone2?: string;
  testApprovalPhone3?: string;
  testApprovalPhone4?: string;
  greenApiInstanceId?: string;
  greenApiToken?: string;
  serviceFormConfig?: ServiceFormConfig;
  aiBotConfig?: AiBotConfig;
  deviceModels?: string[]; // Array of custom device models/types
  models?: (string | SpecificModel)[]; // Array of specific device models with associated deviceType
  factories?: string[]; // Array of manufacturing factories (מפעלים) for China parts orders
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
  city?: string;
  region?: 'CENTER' | 'NORTH' | 'SOUTH' | 'JERUSALEM';
  logoUrl?: string;
  // undefined/true = approved. Only self-registered customers start out
  // explicitly false, pending admin approval; admin-created/imported
  // customers are approved by default so existing flows aren't gated.
  approved?: boolean;
  // Unguessable secret used by the one-click WhatsApp approval link sent to
  // the admin. Only generated for self-registered (pending) customers, and
  // never returned to the customer's own browser.
  approvalToken?: string;
}

export interface Driver {
  id: string; // uuid — also serves as the secret token for the driver's panel link
  name: string;
  phone?: string;
  createdAt: string;
}

export interface Agent {
  id: string; // uuid
  name: string;
  phone: string;
  password?: string;
  passwordPlain?: string;
  token: string; // secret token for agent portal link /[tenantId]/agent/[token]
  createdAt: string;
  updatedAt: string;
}

export interface Technician {
  id: string; // uuid
  name: string;
  phone: string;
  password?: string;
  passwordPlain?: string;
  token: string; // secret token for technician portal link /[tenantId]/technician/[token]
  createdAt: string;
  updatedAt: string;
}

export interface ChinaOrder {
  id: string;
  orderNumber: number;
  partName: string;
  photoImage: string; // base64 webp data URI, stored inline — may be empty
  quantity: number;
  factory: string; // dropdown value from tenant.factories
  status: 'PENDING_APPROVAL' | 'WAITING_TO_ORDER' | 'ORDERED' | 'ARRIVED';
  source: 'admin' | 'technician';
  technicianId?: string;
  technicianName?: string;
  createdAt: string;
  updatedAt: string;
}

// Test/inspection approval requests (בקשת אישור בדיקה). Outbound message to the
// customer is sent manually by the admin (Green API free-tier can't reliably
// auto-send); the customer's "מאשר" reply is picked up automatically by the
// existing WhatsApp webhook, matched by phone, and flips status to APPROVED.
export interface TestApproval {
  id: string;
  requestNumber: number;
  customerId: string;
  customerName: string; // snapshotted at creation, so it survives even if the customer record changes
  customerPhone: string; // normalized (normalizePhone), used to match inbound "מאשר" replies
  toolDescription?: string;
  price: number;
  status: 'PENDING_APPROVAL' | 'APPROVED';
  createdAt: string;
  updatedAt: string;
  approvedAt?: string;
}

export interface PartRequest {
  id: string;
  requestNumber: number;
  customerId: string;
  customer?: Customer;
  description: string;
  photoImage: string; // base64 webp data URI — required
  status: 'NEW' | 'FULFILLED' | 'READY_FOR_DISPATCH';
  quotePrice?: number;
  quoteStatus?: 'NONE' | 'PENDING_APPROVAL' | 'APPROVED' | 'EXPIRED' | 'REJECTED';
  quoteSentAt?: string;
  agentId?: string;
  agentName?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Order {
  id: string;
  orderNumber: number;
  customerId: string;
  customer?: Customer;
  driverId?: string;
  driver?: Driver;
  deviceType: string; // e.g. 'קורקינט', 'אופניים', or a custom type entered by the sales agent
  model?: string; // Open text for the specific model
  quantity: number;
  unitPrice: number;
  totalPrice: number; // quantity * unitPrice, computed at creation
  status: 'PENDING' | 'FULFILLED' | 'READY_FOR_DISPATCH' | 'CANCELLED';
  agentId?: string;
  agentName?: string;
  createdAt: string;
  updatedAt: string;
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
  agentId?: string;
  agentName?: string;
  createdAt: string;
  updatedAt: string;
  issueDescription?: string;
  comments?: string;
  repairLevel?: 'RIDE_ONLY' | 'SAFE_RIDE' | 'LIKE_NEW';
  preApprovedAmount?: number;
  preApprovedNotes?: string;
  /** Admin-defined custom fields captured on the intake form. */
  customFields?: { key: string; label: string; value: string }[];
  pickupSignatureImage?: string;
  pickupPhotoImage?: string;
  pickupSignerName?: string;
  pickupSignedAt?: string;
  pickupConditionNotes?: string;
}

// ---------------- MongoDB Collections ----------------

export async function getMasterDb() {
  const client = await getClientPromise();
  return client.db('master_db');
}

export async function getDb(tenantId: string) {
  const client = await getClientPromise();
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
    db.collection('partRequests').createIndex({ id: 1 }, { unique: true }),
    db.collection('partRequests').createIndex({ customerId: 1 }),
    db.collection('orders').createIndex({ id: 1 }, { unique: true }),
    db.collection('orders').createIndex({ customerId: 1 }),
    db.collection('orders').createIndex({ driverId: 1 }),
    db.collection('agents').createIndex({ id: 1 }, { unique: true }),
    db.collection('agents').createIndex({ token: 1 }, { unique: true }),
    db.collection('technicians').createIndex({ id: 1 }, { unique: true }),
    db.collection('technicians').createIndex({ token: 1 }, { unique: true }),
    db.collection('chinaOrders').createIndex({ id: 1 }, { unique: true }),
    db.collection('chinaOrders').createIndex({ status: 1 }),
    db.collection('chinaOrders').createIndex({ createdAt: -1 }),
    // Lets getCustomerByPhone do a lookup instead of scanning every customer.
    // The AI bot runs it on every inbound WhatsApp message, not just approvals.
    db.collection('customers').createIndex({ phone: 1 }),
    // Green API retries a webhook whenever we answer slowly or non-2xx. The
    // unique index is what makes a retry a no-op instead of a second approval.
    db.collection('botConversations').createIndex({ idMessage: 1 }, { unique: true, sparse: true }),
    db.collection('botConversations').createIndex({ phone: 1, createdAt: -1 }),
    db.collection('botConversations').createIndex({ createdAt: -1 }),
    db.collection('botConversations').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    db.collection('botUsage').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
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
  update: { name?: string; businessName?: string; logoUrl?: string; primaryColor?: string; adminPassword?: string; adminPasswordPlain?: string; whatsappTemplate?: string; partsRequestPhone?: string; partsDeletePassword?: string; adminWhatsappPhone?: string; adminWhatsappPhone2?: string; adminWhatsappPhone3?: string; quoteNotificationPhones?: string; chinaOrderNotificationPhones?: string; testApprovalPrice?: number; testApprovalPhone1?: string; testApprovalPhone2?: string; testApprovalPhone3?: string; testApprovalPhone4?: string; greenApiInstanceId?: string; greenApiToken?: string; serviceFormConfig?: ServiceFormConfig; aiBotConfig?: AiBotConfig }
): Promise<void> {
  const db = await getMasterDb();
  const setObj: Record<string, any> = {};
  if (update.businessName !== undefined) {
    setObj.name = update.businessName;
    setObj.businessName = update.businessName;
  }
  if (update.whatsappTemplate !== undefined) setObj.whatsappTemplate = update.whatsappTemplate;
  if (update.partsRequestPhone !== undefined) setObj.partsRequestPhone = update.partsRequestPhone;
  if (update.partsDeletePassword !== undefined) setObj.partsDeletePassword = update.partsDeletePassword;
  if (update.adminWhatsappPhone !== undefined) setObj.adminWhatsappPhone = update.adminWhatsappPhone;
  if (update.adminWhatsappPhone2 !== undefined) setObj.adminWhatsappPhone2 = update.adminWhatsappPhone2;
  if (update.adminWhatsappPhone3 !== undefined) setObj.adminWhatsappPhone3 = update.adminWhatsappPhone3;
  if (update.quoteNotificationPhones !== undefined) setObj.quoteNotificationPhones = update.quoteNotificationPhones;
  if (update.chinaOrderNotificationPhones !== undefined) setObj.chinaOrderNotificationPhones = update.chinaOrderNotificationPhones;
  if (update.testApprovalPrice !== undefined) setObj.testApprovalPrice = update.testApprovalPrice;
  if (update.testApprovalPhone1 !== undefined) setObj.testApprovalPhone1 = update.testApprovalPhone1;
  if (update.testApprovalPhone2 !== undefined) setObj.testApprovalPhone2 = update.testApprovalPhone2;
  if (update.testApprovalPhone3 !== undefined) setObj.testApprovalPhone3 = update.testApprovalPhone3;
  if (update.testApprovalPhone4 !== undefined) setObj.testApprovalPhone4 = update.testApprovalPhone4;
  if (update.greenApiInstanceId !== undefined) setObj.greenApiInstanceId = update.greenApiInstanceId;
  if (update.greenApiToken !== undefined) setObj.greenApiToken = update.greenApiToken;
  if (update.logoUrl !== undefined) setObj.logoUrl = update.logoUrl;
  if (update.primaryColor !== undefined) setObj.primaryColor = update.primaryColor;
  if (update.serviceFormConfig !== undefined) setObj.serviceFormConfig = update.serviceFormConfig;
  if (update.aiBotConfig !== undefined) setObj.aiBotConfig = update.aiBotConfig;
  if (update.adminPassword !== undefined) setObj.adminPassword = update.adminPassword;
  if (update.adminPasswordPlain !== undefined) setObj.adminPasswordPlain = update.adminPasswordPlain;

  if (Object.keys(setObj).length > 0) {
    await db.collection('tenants').updateOne({ id }, { $set: setObj });
  }
}

export async function addDeviceModelToTenant(id: string, modelName: string): Promise<string[]> {
  const db = await getMasterDb();
  const trimmed = modelName.trim();
  if (!trimmed) return [];

  await db.collection('tenants').updateOne(
    { id },
    { $addToSet: { deviceModels: trimmed } } as any
  );

  const tenant = await db.collection('tenants').findOne({ id });
  return tenant?.deviceModels || [trimmed];
}

export function normalizeModels(rawModels?: any[]): SpecificModel[] {
  if (!Array.isArray(rawModels)) return [];
  return rawModels.map(m => {
    if (typeof m === 'string') {
      return { name: m, deviceType: '' };
    }
    if (m && typeof m === 'object' && typeof m.name === 'string') {
      return { name: m.name, deviceType: typeof m.deviceType === 'string' ? m.deviceType : '' };
    }
    return { name: String(m), deviceType: '' };
  });
}

export async function addModelToTenant(id: string, modelName: string, deviceType?: string): Promise<SpecificModel[]> {
  const db = await getMasterDb();
  const trimmedName = modelName.trim();
  const trimmedType = (deviceType || '').trim();
  if (!trimmedName) return [];

  const modelObj: SpecificModel = { name: trimmedName, deviceType: trimmedType };

  // Remove existing model with same name if any, then push new modelObj
  await db.collection('tenants').updateOne(
    { id },
    { $pull: { models: { name: trimmedName } } } as any
  );
  await db.collection('tenants').updateOne(
    { id },
    { $pull: { models: trimmedName } } as any
  );

  await db.collection('tenants').updateOne(
    { id },
    { $push: { models: modelObj } } as any
  );

  const tenant = await db.collection('tenants').findOne({ id });
  return normalizeModels(tenant?.models);
}

export async function deleteDeviceModelFromTenant(id: string, modelName: string): Promise<string[]> {
  const db = await getMasterDb();
  await db.collection('tenants').updateOne(
    { id },
    { $pull: { deviceModels: modelName } } as any
  );
  const tenant = await db.collection('tenants').findOne({ id });
  return tenant?.deviceModels || [];
}

export async function addFactoryToTenant(id: string, factoryName: string): Promise<string[]> {
  const db = await getMasterDb();
  const trimmed = factoryName.trim();
  if (!trimmed) return [];

  await db.collection('tenants').updateOne(
    { id },
    { $addToSet: { factories: trimmed } } as any
  );

  const tenant = await db.collection('tenants').findOne({ id });
  return tenant?.factories || [trimmed];
}

export async function deleteFactoryFromTenant(id: string, factoryName: string): Promise<string[]> {
  const db = await getMasterDb();
  await db.collection('tenants').updateOne(
    { id },
    { $pull: { factories: factoryName } } as any
  );
  const tenant = await db.collection('tenants').findOne({ id });
  return tenant?.factories || [];
}

export async function deleteModelFromTenant(id: string, modelName: string): Promise<SpecificModel[]> {
  const db = await getMasterDb();
  await db.collection('tenants').updateOne(
    { id },
    { $pull: { models: { name: modelName } } } as any
  );
  await db.collection('tenants').updateOne(
    { id },
    { $pull: { models: modelName } } as any
  );
  const tenant = await db.collection('tenants').findOne({ id });
  return normalizeModels(tenant?.models);
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
  const { _id, approvalToken, ...rest } = customer;
  void approvalToken;
  return rest as Customer;
}

/**
 * The one place allowed to read a customer's approvalToken (the one-click
 * WhatsApp admin-approval secret) — used only to build that admin-only link
 * and to verify it on the approve endpoint. getCustomerById/getCustomerByPhone
 * strip this field so it never reaches a customer-facing response.
 */
export async function getCustomerApprovalToken(tenantId: string, id: string): Promise<string | undefined> {
  const db = await getDb(tenantId);
  const customer = await db.collection('customers').findOne({ id }, { projection: { approvalToken: 1 } });
  return customer?.approvalToken;
}

export function normalizePhone(phone: string): string {
  if (!phone) return '';
  let digits = phone.replace(/\D/g, '');
  if (digits.startsWith('972')) {
    digits = '0' + digits.slice(3);
  }
  return digits;
}

export async function getCustomerByPhone(tenantId: string, phone: string): Promise<Customer | undefined> {
  const normalizedInput = normalizePhone(phone);
  if (!normalizedInput) return undefined;

  // Fast path: an indexed lookup on the exact spellings we store most often.
  // Covers the overwhelming majority and matters because the AI bot resolves a
  // customer on every inbound message, not just on the rare approval reply.
  const db = await getDb(tenantId);
  const intl = normalizedInput.startsWith('0') ? '972' + normalizedInput.slice(1) : normalizedInput;
  const direct = await db.collection('customers').findOne({
    phone: { $in: [normalizedInput, intl, '+' + intl] },
  });
  if (direct) {
    const { _id, approvalToken, ...rest } = direct;
    void _id;
    void approvalToken;
    return rest as unknown as Customer;
  }

  // Slow path: stored numbers may carry dashes, spaces or parentheses, which no
  // index can match. Same result set as before, just reached less often.
  const customers = await getCustomers(tenantId);
  const found = customers.find(c => c.phone && normalizePhone(c.phone) === normalizedInput);
  if (!found) return undefined;
  const { approvalToken, ...rest } = found as Customer & { approvalToken?: string };
  void approvalToken;
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
  // Requests/orders assigned to this driver become unassigned, never deleted.
  const updatedAt = new Date().toISOString();
  await Promise.all([
    db.collection('serviceRequests').updateMany(
      { driverId: id },
      { $unset: { driverId: '' }, $set: { updatedAt } }
    ),
    db.collection('orders').updateMany(
      { driverId: id },
      { $unset: { driverId: '' }, $set: { updatedAt } }
    ),
  ]);
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

// The `customers`/`drivers` options let a caller that has already loaded those
// collections (e.g. the admin page, which needs them for several joins) pass
// them in, so this function doesn't re-scan them — avoiding N redundant Atlas
// round-trips per page load.
type ServiceRequestsOptions = {
  page?: number;
  limit?: number;
  excludeImages?: boolean;
  customers?: Customer[];
  drivers?: Driver[];
};

export async function getServiceRequests(tenantId: string): Promise<ServiceRequest[]>;
export async function getServiceRequests(tenantId: string, options: ServiceRequestsOptions): Promise<{ requests: ServiceRequest[]; total: number }>;
export async function getServiceRequests(tenantId: string, options?: ServiceRequestsOptions): Promise<any> {
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

  // These queries are independent — running them in parallel instead of
  // sequentially avoids paying round-trip latency to MongoDB Atlas over and
  // over. When the caller already has customers/drivers, reuse them.
  const [requests, total, customers, drivers] = await Promise.all([
    cursor.toArray(),
    db.collection('serviceRequests').countDocuments({}),
    options?.customers ? Promise.resolve(options.customers) : getCustomers(tenantId),
    options?.drivers ? Promise.resolve(options.drivers) : getDrivers(tenantId),
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
// NOTE: getServiceRequestById (single request WITH images, used by the admin
// detail modal to load images on demand) is defined further below.

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

// ---------------- Part Requests ----------------

// excludeImages projects out the base64 photoImage so list views don't ship it
// (thumbnails load on demand via the image endpoint). customers can be passed
// in by a caller that already loaded them, to skip a redundant scan.
export async function getPartRequests(
  tenantId: string,
  options?: { excludeImages?: boolean; customers?: Customer[] }
): Promise<PartRequest[]> {
  const db = await getDb(tenantId);
  const projection = options?.excludeImages ? { photoImage: 0 } : {};
  const [requests, customers] = await Promise.all([
    db.collection('partRequests').find({}, { projection }).sort({ createdAt: -1 }).toArray(),
    options?.customers ? Promise.resolve(options.customers) : getCustomers(tenantId),
  ]);
  return requests.map(r => {
    const { _id, ...rest } = r;
    void _id;
    return {
      ...(rest as unknown as PartRequest),
      customer: customers.find(c => c.id === rest.customerId),
    };
  });
}

export async function getPartRequestById(tenantId: string, id: string): Promise<PartRequest | undefined> {
  const db = await getDb(tenantId);
  const request = await db.collection('partRequests').findOne({ id });
  if (!request) return undefined;
  const { _id, ...rest } = request;
  void _id;
  const customer = rest.customerId ? await getCustomerById(tenantId, rest.customerId) : undefined;
  return {
    ...(rest as unknown as PartRequest),
    customer,
  };
}

export async function getPartRequestsByCustomerId(tenantId: string, customerId: string): Promise<PartRequest[]> {
  const db = await getDb(tenantId);
  const requests = await db.collection('partRequests')
    .find({ customerId })
    .sort({ createdAt: -1 })
    .toArray();

  const customer = await getCustomerById(tenantId, customerId);

  return requests.map(r => {
    const { _id, ...rest } = r;
    void _id;
    return {
      ...(rest as unknown as PartRequest),
      customer: customer || undefined,
    };
  });
}

export async function createPartRequest(
  tenantId: string,
  request: Omit<PartRequest, 'id' | 'requestNumber' | 'status' | 'createdAt' | 'updatedAt'>
): Promise<PartRequest> {
  const db = await getDb(tenantId);

  const counterResult = await db.collection('counters').findOneAndUpdate(
    { _id: 'partRequestNumber' as any },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: 'after' }
  );
  const requestNumber = counterResult?.seq || 1;

  const newRequest: PartRequest = {
    ...request,
    id: crypto.randomUUID(),
    requestNumber,
    status: 'NEW',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await db.collection('partRequests').insertOne(newRequest as unknown as Document);
  return newRequest;
}

export async function updatePartRequestStatus(
  tenantId: string,
  id: string,
  status: 'NEW' | 'FULFILLED'
): Promise<PartRequest | undefined> {
  const db = await getDb(tenantId);
  const updatedAt = new Date().toISOString();

  const result = await db.collection('partRequests').findOneAndUpdate(
    { id },
    { $set: { status, updatedAt } },
    { returnDocument: 'after' }
  );

  if (!result) return undefined;
  const { _id, ...rest } = result;
  void _id;
  return rest as unknown as PartRequest;
}

export async function deletePartRequest(tenantId: string, id: string): Promise<boolean> {
  const db = await getDb(tenantId);
  const result = await db.collection('partRequests').deleteOne({ id });
  return result.deletedCount === 1;
}

// ---------------- Orders (merchandise) ----------------

export async function getOrders(
  tenantId: string,
  options?: { customers?: Customer[]; drivers?: Driver[] }
): Promise<Order[]> {
  const db = await getDb(tenantId);
  const [orders, customers, drivers] = await Promise.all([
    db.collection('orders').find({}).sort({ createdAt: -1 }).toArray(),
    options?.customers ? Promise.resolve(options.customers) : getCustomers(tenantId),
    options?.drivers ? Promise.resolve(options.drivers) : getDrivers(tenantId),
  ]);
  return orders.map(o => {
    const { _id, ...rest } = o;
    void _id;
    return {
      ...(rest as unknown as Order),
      customer: customers.find(c => c.id === rest.customerId),
      driver: rest.driverId ? drivers.find(d => d.id === rest.driverId) : undefined,
    };
  });
}

export async function getOrdersByCustomerId(tenantId: string, customerId: string): Promise<Order[]> {
  const db = await getDb(tenantId);
  const [orders, customer, drivers] = await Promise.all([
    db.collection('orders').find({ customerId }).sort({ createdAt: -1 }).toArray(),
    getCustomerById(tenantId, customerId),
    getDrivers(tenantId),
  ]);
  return orders.map(o => {
    const { _id, ...rest } = o;
    void _id;
    return {
      ...(rest as unknown as Order),
      customer: customer || undefined,
      driver: rest.driverId ? drivers.find(d => d.id === rest.driverId) : undefined,
    };
  });
}

export async function createOrder(
  tenantId: string,
  order: Omit<Order, 'id' | 'orderNumber' | 'totalPrice' | 'status' | 'driver' | 'createdAt' | 'updatedAt'>
): Promise<Order> {
  const db = await getDb(tenantId);

  const counterResult = await db.collection('counters').findOneAndUpdate(
    { _id: 'orderNumber' as any },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: 'after' }
  );
  const orderNumber = counterResult?.seq || 1;

  const newOrder: Order = {
    ...order,
    id: crypto.randomUUID(),
    orderNumber,
    totalPrice: order.quantity * order.unitPrice,
    status: 'PENDING',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await db.collection('orders').insertOne(newOrder as unknown as Document);
  return newOrder;
}

export async function assignDriverToOrder(
  tenantId: string,
  orderId: string,
  driverId: string | null
): Promise<Order | undefined> {
  const db = await getDb(tenantId);
  const updatedAt = new Date().toISOString();
  const update = driverId
    ? { $set: { driverId, updatedAt } }
    : { $set: { updatedAt }, $unset: { driverId: '' } };
  const result = await db.collection('orders').findOneAndUpdate(
    { id: orderId },
    update,
    { returnDocument: 'after' }
  );
  if (!result) return undefined;
  const { _id, ...rest } = result;
  void _id;
  return rest as unknown as Order;
}

export async function updateOrderStatus(
  tenantId: string,
  id: string,
  status: 'PENDING' | 'FULFILLED' | 'READY_FOR_DISPATCH' | 'CANCELLED'
): Promise<Order | undefined> {
  const db = await getDb(tenantId);
  const updatedAt = new Date().toISOString();

  const result = await db.collection('orders').findOneAndUpdate(
    { id },
    { $set: { status, updatedAt } },
    { returnDocument: 'after' }
  );

  if (!result) return undefined;
  const { _id, ...rest } = result;
  void _id;
  return rest as unknown as Order;
}

export async function deleteOrder(tenantId: string, id: string): Promise<boolean> {
  const db = await getDb(tenantId);
  const result = await db.collection('orders').deleteOne({ id });
  return result.deletedCount === 1;
}

// ---------------- Sales Agents CRUD Helpers ----------------

export async function getAgents(tenantId: string): Promise<Agent[]> {
  const db = await getDb(tenantId);
  const agents = await db.collection('agents').find({}).sort({ createdAt: -1 }).toArray();
  return agents.map(a => {
    const { _id, ...rest } = a;
    void _id;
    return rest as unknown as Agent;
  });
}

export async function getAgentById(tenantId: string, id: string): Promise<Agent | undefined> {
  const db = await getDb(tenantId);
  const agent = await db.collection('agents').findOne({ id });
  if (!agent) return undefined;
  const { _id, ...rest } = agent;
  void _id;
  return rest as unknown as Agent;
}

export async function getAgentByToken(tenantId: string, token: string): Promise<Agent | undefined> {
  const db = await getDb(tenantId);
  const agent = await db.collection('agents').findOne({ token });
  if (!agent) return undefined;
  const { _id, ...rest } = agent;
  void _id;
  return rest as unknown as Agent;
}

export async function createAgent(
  tenantId: string,
  agent: { name: string; phone: string; password?: string }
): Promise<Agent> {
  const db = await getDb(tenantId);
  const token = crypto.randomBytes(16).toString('hex');
  const now = new Date().toISOString();
  const pwd = (agent.password || '').trim();
  const newAgent: Agent = {
    id: crypto.randomUUID(),
    name: agent.name,
    phone: agent.phone,
    password: pwd,
    passwordPlain: pwd,
    token,
    createdAt: now,
    updatedAt: now,
  };
  await db.collection('agents').insertOne(newAgent as unknown as Document);
  return newAgent;
}

export async function deleteAgent(tenantId: string, id: string): Promise<boolean> {
  const db = await getDb(tenantId);
  const result = await db.collection('agents').deleteOne({ id });
  return result.deletedCount === 1;
}

export async function getServiceRequestsByAgentId(
  tenantId: string,
  agentId: string,
  options?: { customers?: Customer[]; drivers?: Driver[] }
): Promise<ServiceRequest[]> {
  const db = await getDb(tenantId);
  const rawRequests = await db.collection('serviceRequests').find({ agentId }).sort({ createdAt: -1 }).toArray();

  const [customers, drivers] = await Promise.all([
    options?.customers ? Promise.resolve(options.customers) : getCustomers(tenantId),
    options?.drivers ? Promise.resolve(options.drivers) : getDrivers(tenantId),
  ]);

  const customerMap = new Map(customers.map(c => [c.id, c]));
  const driverMap = new Map(drivers.map(d => [d.id, d]));

  return rawRequests.map(doc => {
    const { _id, ...rest } = doc;
    void _id;
    const request = rest as unknown as ServiceRequest;
    return {
      ...request,
      customer: customerMap.get(request.customerId),
      driver: request.driverId ? driverMap.get(request.driverId) : undefined,
    };
  });
}

export async function getPartRequestsByAgentId(
  tenantId: string,
  agentId: string,
  options?: { customers?: Customer[] }
): Promise<PartRequest[]> {
  const db = await getDb(tenantId);
  const rawRequests = await db.collection('partRequests').find({ agentId }).sort({ createdAt: -1 }).toArray();

  const customers = options?.customers ? await Promise.resolve(options.customers) : await getCustomers(tenantId);
  const customerMap = new Map(customers.map(c => [c.id, c]));

  return rawRequests.map(doc => {
    const { _id, ...rest } = doc;
    void _id;
    const req = rest as unknown as PartRequest;
    return {
      ...req,
      customer: customerMap.get(req.customerId),
    };
  });
}

export async function getOrdersByAgentId(
  tenantId: string,
  agentId: string,
  options?: { customers?: Customer[]; drivers?: Driver[] }
): Promise<Order[]> {
  const db = await getDb(tenantId);
  const rawOrders = await db.collection('orders').find({ agentId }).sort({ createdAt: -1 }).toArray();

  const [customers, drivers] = await Promise.all([
    options?.customers ? Promise.resolve(options.customers) : getCustomers(tenantId),
    options?.drivers ? Promise.resolve(options.drivers) : getDrivers(tenantId),
  ]);

  const customerMap = new Map(customers.map(c => [c.id, c]));
  const driverMap = new Map(drivers.map(d => [d.id, d]));

  return rawOrders.map(doc => {
    const { _id, ...rest } = doc;
    void _id;
    const order = rest as unknown as Order;
    return {
      ...order,
      customer: customerMap.get(order.customerId),
      driver: order.driverId ? driverMap.get(order.driverId) : undefined,
    };
  });
}

// ---------------- Technicians CRUD Helpers ----------------

export async function getTechnicians(tenantId: string): Promise<Technician[]> {
  const db = await getDb(tenantId);
  const technicians = await db.collection('technicians').find({}).sort({ createdAt: -1 }).toArray();
  return technicians.map(t => {
    const { _id, ...rest } = t;
    void _id;
    return rest as unknown as Technician;
  });
}

export async function getTechnicianById(tenantId: string, id: string): Promise<Technician | undefined> {
  const db = await getDb(tenantId);
  const technician = await db.collection('technicians').findOne({ id });
  if (!technician) return undefined;
  const { _id, ...rest } = technician;
  void _id;
  return rest as unknown as Technician;
}

export async function getTechnicianByToken(tenantId: string, token: string): Promise<Technician | undefined> {
  const db = await getDb(tenantId);
  const technician = await db.collection('technicians').findOne({ token });
  if (!technician) return undefined;
  const { _id, ...rest } = technician;
  void _id;
  return rest as unknown as Technician;
}

export async function createTechnician(
  tenantId: string,
  technician: { name: string; phone: string; password?: string }
): Promise<Technician> {
  const db = await getDb(tenantId);
  const token = crypto.randomBytes(16).toString('hex');
  const now = new Date().toISOString();
  const pwd = (technician.password || '').trim();
  const newTechnician: Technician = {
    id: crypto.randomUUID(),
    name: technician.name,
    phone: technician.phone,
    password: pwd,
    passwordPlain: pwd,
    token,
    createdAt: now,
    updatedAt: now,
  };
  await db.collection('technicians').insertOne(newTechnician as unknown as Document);
  return newTechnician;
}

export async function deleteTechnician(tenantId: string, id: string): Promise<boolean> {
  const db = await getDb(tenantId);
  const result = await db.collection('technicians').deleteOne({ id });
  return result.deletedCount === 1;
}

// ---------------- China Parts Orders CRUD Helpers ----------------

// excludeImages projects out the base64 photoImage so list views don't ship it
// (thumbnails load on demand via the china-orders image endpoint).
export async function getChinaOrders(
  tenantId: string,
  options?: { excludeImages?: boolean; status?: ChinaOrder['status'] }
): Promise<ChinaOrder[]> {
  const db = await getDb(tenantId);
  const projection = options?.excludeImages ? { photoImage: 0 } : {};
  const filter = options?.status ? { status: options.status } : {};
  const orders = await db.collection('chinaOrders')
    .find(filter, { projection })
    .sort({ createdAt: -1 })
    .toArray();
  return orders.map(o => {
    const { _id, ...rest } = o;
    void _id;
    return rest as unknown as ChinaOrder;
  });
}

export async function getChinaOrderById(tenantId: string, id: string): Promise<ChinaOrder | undefined> {
  const db = await getDb(tenantId);
  const order = await db.collection('chinaOrders').findOne({ id });
  if (!order) return undefined;
  const { _id, ...rest } = order;
  void _id;
  return rest as unknown as ChinaOrder;
}

export async function createChinaOrder(
  tenantId: string,
  order: Omit<ChinaOrder, 'id' | 'orderNumber' | 'createdAt' | 'updatedAt'>
): Promise<ChinaOrder> {
  const db = await getDb(tenantId);

  const counterResult = await db.collection('counters').findOneAndUpdate(
    { _id: 'chinaOrderNumber' as any },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: 'after' }
  );
  const orderNumber = counterResult?.seq || 1;

  const now = new Date().toISOString();
  const newOrder: ChinaOrder = {
    ...order,
    id: crypto.randomUUID(),
    orderNumber,
    createdAt: now,
    updatedAt: now,
  };

  await db.collection('chinaOrders').insertOne(newOrder as unknown as Document);
  return newOrder;
}

export async function updateChinaOrderStatus(
  tenantId: string,
  id: string,
  status: ChinaOrder['status']
): Promise<ChinaOrder | undefined> {
  const db = await getDb(tenantId);
  const updatedAt = new Date().toISOString();

  const result = await db.collection('chinaOrders').findOneAndUpdate(
    { id },
    { $set: { status, updatedAt } },
    { returnDocument: 'after' }
  );

  if (!result) return undefined;
  const { _id, ...rest } = result;
  void _id;
  return rest as unknown as ChinaOrder;
}

export async function deleteChinaOrder(tenantId: string, id: string): Promise<boolean> {
  const db = await getDb(tenantId);
  const result = await db.collection('chinaOrders').deleteOne({ id });
  return result.deletedCount === 1;
}

// ---------------- Test/Inspection Approval Requests CRUD Helpers ----------------

export async function getTestApprovals(tenantId: string): Promise<TestApproval[]> {
  const db = await getDb(tenantId);
  const approvals = await db.collection('testApprovals').find({}).sort({ createdAt: -1 }).toArray();
  return approvals.map(a => {
    const { _id, ...rest } = a;
    void _id;
    return rest as unknown as TestApproval;
  });
}

export async function getTestApprovalById(tenantId: string, id: string): Promise<TestApproval | undefined> {
  const db = await getDb(tenantId);
  const approval = await db.collection('testApprovals').findOne({ id });
  if (!approval) return undefined;
  const { _id, ...rest } = approval;
  void _id;
  return rest as unknown as TestApproval;
}

// Matches the sender's normalized phone against pending test-approval requests —
// used by the WhatsApp webhook's deterministic "מאשר" path, the same way the
// existing part-request quote approval resolves by phone rather than by a
// customer lookup (works even if the phone was entered slightly differently).
export async function getPendingTestApprovalsByPhone(tenantId: string, phone: string): Promise<TestApproval[]> {
  const db = await getDb(tenantId);
  const normalized = normalizePhone(phone);
  if (!normalized) return [];
  const approvals = await db.collection('testApprovals').find({
    status: 'PENDING_APPROVAL',
    customerPhone: normalized,
  }).toArray();
  return approvals.map(a => {
    const { _id, ...rest } = a;
    void _id;
    return rest as unknown as TestApproval;
  });
}

export async function createTestApproval(
  tenantId: string,
  approval: Omit<TestApproval, 'id' | 'requestNumber' | 'status' | 'createdAt' | 'updatedAt'>
): Promise<TestApproval> {
  const db = await getDb(tenantId);

  const counterResult = await db.collection('counters').findOneAndUpdate(
    { _id: 'testApprovalNumber' as any },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: 'after' }
  );
  const requestNumber = counterResult?.seq || 1;

  const now = new Date().toISOString();
  const newApproval: TestApproval = {
    ...approval,
    id: crypto.randomUUID(),
    requestNumber,
    status: 'PENDING_APPROVAL',
    createdAt: now,
    updatedAt: now,
  };

  await db.collection('testApprovals').insertOne(newApproval as unknown as Document);
  return newApproval;
}

export async function updateTestApprovalStatus(
  tenantId: string,
  id: string,
  status: TestApproval['status']
): Promise<TestApproval | undefined> {
  const db = await getDb(tenantId);
  const updatedAt = new Date().toISOString();
  const set: Record<string, unknown> = { status, updatedAt };
  if (status === 'APPROVED') set.approvedAt = updatedAt;

  const result = await db.collection('testApprovals').findOneAndUpdate(
    { id },
    { $set: set },
    { returnDocument: 'after' }
  );

  if (!result) return undefined;
  const { _id, ...rest } = result;
  void _id;
  return rest as unknown as TestApproval;
}

export async function deleteTestApproval(tenantId: string, id: string): Promise<boolean> {
  const db = await getDb(tenantId);
  const result = await db.collection('testApprovals').deleteOne({ id });
  return result.deletedCount === 1;
}
