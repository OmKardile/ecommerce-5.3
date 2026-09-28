// Patel Networks — catalog seed (documented business data from the master plan + ADRs).
// Seeds: categories, brands, products w/ multi-attribute variants & SKUs, inventory,
// admin + test customer, coupons, banners, kit-builder bundle, blog posts, settings.
// All prices are documented sample catalog data (labeled as seed data in the docs).

import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/server/services/auth.service';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const prisma = new PrismaClient();

interface ImageBank {
  [key: string]: string[];
}

function loadImages(): ImageBank {
  try {
    const raw = readFileSync(resolve(__dirname, './seed-images.json'), 'utf-8');
    return JSON.parse(raw) as ImageBank;
  } catch {
    return {};
  }
}

const IMAGES = loadImages();
let imgCursor = 0;
function img(key: string, fallback?: string): string | undefined {
  const bank = IMAGES[key]?.filter(Boolean) ?? [];
  if (bank.length) return bank[imgCursor++ % bank.length];
  return fallback;
}

// =============================================================================
// VOLUMETRIC SEED TOOLKIT (Task 30) — deterministic fake-history generators.
// Every generator is driven by mulberry32(20260927) so re-seeds rebuild the
// exact same dataset (comparable screenshots, stable dashboards).
// =============================================================================
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(20260927);
const pick = <T>(arr: T[]): T => arr[Math.floor(rnd() * arr.length)];
const randInt = (min: number, max: number): number => min + Math.floor(rnd() * (max - min + 1));
/** Date `minDays`..`maxDays` ago at a random business hour (never in the future). */
function daysAgo(minDays: number, maxDays: number): Date {
  const d = new Date(Date.now() - (minDays + rnd() * (maxDays - minDays)) * 86400000);
  d.setHours(randInt(9, 21), randInt(0, 59), randInt(0, 59), 0);
  if (d.getTime() > Date.now()) d.setTime(Date.now() - 3600000);
  return d;
}
const addHours = (d: Date, h: number): Date => new Date(d.getTime() + h * 3600000);
const addDays = (d: Date, n: number): Date => new Date(d.getTime() + n * 86400000);
/** GSTIN: 24 (Gujarat) + PAN(5 letters, 4 digits, 1 letter) + 1 + Z + checksum */
function genGstin(i: number): string {
  const L = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const letters = () => L[randInt(0, 23)] + L[randInt(0, 23)] + L[randInt(0, 23)] + L[randInt(0, 23)] + L[randInt(0, 23)];
  return `24${letters()}${1000 + i}${L[randInt(0, 23)]}1Z${randInt(0, 9)}`;
}

const FIRST_NAMES = ['Rajesh', 'Amit', 'Priya', 'Nilesh', 'Meera', 'Jignesh', 'Kinjal', 'Hardik', 'Bhavna', 'Paresh', 'Dhruv', 'Krina', 'Mayur', 'Nisha', 'Sandeep', 'Falgun', 'Tejas', 'Hetal', 'Vishal', 'Payal', 'Mehul', 'Shreya', 'Bhargav', 'Dhwani', 'Chirag', 'Foram', 'Kaushal', 'Mital', 'Nirav', 'Pooja'];
const LAST_NAMES = ['Patel', 'Shah', 'Desai', 'Mehta', 'Trivedi', 'Joshi', 'Chauhan', 'Parmar', 'Modi', 'Bhatt', 'Rana', 'Solanki', 'Kapadia', 'Sanghvi', 'Amin'];
const COMPANIES = ['Shreeji Electricals', 'Krishna Security Systems', 'Sardar Traders', 'Surat CCTV Hub', 'Navkar Enterprises', 'Golden Gate Computers', 'Om Sai Networks', 'Riddhi Siddhi Solutions', 'Vyapaar Technologies', 'Diamond City Security', 'Sahjanand Trading Co.', 'Jalaram Enterprises', 'Shakti Surveillance', 'Kuber Systems', 'Annapurna Cables'];
// [city, state, pincode] — Surat/Gujarat weighted (home turf); PIN always matches its city
const CITIES: [string, string, string][] = [
  ['Surat', 'Gujarat', '395009'], ['Surat', 'Gujarat', '395010'], ['Surat', 'Gujarat', '395006'],
  ['Surat', 'Gujarat', '395002'], ['Surat', 'Gujarat', '395007'],
  ['Ahmedabad', 'Gujarat', '380015'], ['Ahmedabad', 'Gujarat', '380006'], ['Vadodara', 'Gujarat', '390019'],
  ['Rajkot', 'Gujarat', '360005'], ['Bhavnagar', 'Gujarat', '364001'], ['Bharuch', 'Gujarat', '392001'],
  ['Vapi', 'Gujarat', '396195'], ['Navsari', 'Gujarat', '396445'],
  ['Mumbai', 'Maharashtra', '400001'], ['Pune', 'Maharashtra', '411001'], ['Nashik', 'Maharashtra', '422001'],
  ['Delhi', 'Delhi', '110001'], ['Jaipur', 'Rajasthan', '302001'], ['Indore', 'Madhya Pradesh', '452001'],
];
const STREETS = ['Shop 14, Ring Road Market', 'B-402, Silver Business Point, VIP Circle', 'Plot 27, GIDC Pandesara', '3rd Floor, Millennium Mall, Adajan', '22, Udhna Udyog Nagar, Udhna', 'A-9, Lajamni Complex, Mota Varachha', '501, Iscon Emporio, Vesu', '15, Bhatar Road, Opp. Big Bazaar', 'Survey 218, Dumas Road, Piplod', 'Warehouse 4, Sachin GIDC'];
const LANDMARKS = ['Near Omega Hospital', 'Opp. Rajhans Multiplex', 'Behind VR Surat', 'Airport Circle', 'Near Star Bazaar', 'Opp. Maharashtra Store'];
const COURIERS = ['Delhivery Surface', 'XpressBees', 'DTDC Express', 'BlueDart Surface', 'Ecom Express'];
const TRANSIT_HUBS = ['Ahmedabad Hub', 'Vadodara Hub', 'Mumbai Hub', 'Surat Hub'];
const REVIEW_POOL: [number, string, string][] = [
  [5, 'Solid night vision', 'Installed six units around a warehouse — IR stays clean to about 20m and the housing has survived two monsoons without fogging.'],
  [5, 'Genuine product, fast dispatch', 'Sealed box with brand warranty card. Invoice had correct HSN and my GSTIN — input credit went through in GSTR-2B without issues.'],
  [4, 'Good value for the price', 'Image quality is sharper than expected for this tier. Docking one star because the mounting bracket feels light for windy terraces.'],
  [5, 'Clean mobile viewing', 'Configured remote view in ten minutes. Playback search on the Purple drive is quick even with four cameras writing 24/7.'],
  [4, 'Recommended for shops', 'Covered our showroom counter and godown entrance. Colors look accurate in daylight; night mode is usable up to the promised range.'],
  [5, 'Repeat purchase', 'This is my third order from Patel Networks — packaging is always proper and the serial numbers match the warranty cards.'],
  [3, 'Does the job', 'Works as specified. Firmware UI feels dated but once configured you never need to touch it again.'],
  [5, 'Excellent for retrofit', 'Reused the existing coax runs — no rewiring needed. Picture on the 5MP-lite channel is more than enough for identification.'],
  [4, 'Sturdy build', 'Metal housing, proper grommets, and the pigtail connectors felt tight. Survived a full Gujarat summer on a west-facing wall.'],
  [5, 'Support knows their stuff', 'Called with a PoE budget question before ordering — they actually did the math for my camera count instead of pushing a bigger switch.'],
];
const B2B_MESSAGES = [
  'Need quotation for 32 dome cameras + 2 NVRs with installation support at our textile unit in Pandesara. Monthly repeat orders possible.',
  'We are an AMC contractor in Surat. Looking for dealer pricing on HD analog cameras and 3+1 cable — volume around 200 cameras per quarter.',
  'Please share bulk price list for Cat6 boxes and RJ45 kits. We do structured cabling for new offices across South Gujarat.',
  'Interested in 4MP ColorVu stock for a mall project (48 units). Need GST invoice with our company name and staged delivery.',
  'Do you offer demo units for NVR + 8 camera setup before we finalize the society annual maintenance contract?',
  'Require surveillance HDDs (2TB) on a monthly basis for our rental DVR fleet. What payment terms do you offer for B2B accounts?',
];
const AUDIT_ACTIONS: [string, string, string][] = [
  ['order.status_changed', 'Order', 'moved order forward'],
  ['order.viewed', 'Order', 'opened order in admin console'],
  ['product.updated', 'Product', 'updated product details'],
  ['product.price_changed', 'Product', 'revised selling price'],
  ['inventory.manual_adjustment', 'Sku', 'manual stock correction'],
  ['coupon.created', 'Coupon', 'created discount coupon'],
  ['settings.updated', 'Setting', 'updated store settings'],
  ['staff.login', 'Session', 'signed into admin console'],
  ['return.status_changed', 'OrderReturn', 'processed return'],
];
const NOTE_POOL = ['Gatekeeper to confirm before dispatch', 'Customer asked for delivery after 5 PM', 'Install site — call before reaching', 'B2B counter sale picked from store', 'Leave with security if closed'];

// Order status lifecycle used to synthesize OrderStatusHistory rows.
const STATUS_FLOW = ['PENDING_PAYMENT', 'PAID', 'CONFIRMED', 'PROCESSING', 'PACKED', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'RETURN_REQUESTED', 'RETURNED', 'REFUNDED'];

interface OrderBlueprint {
  orderNumber: string;
  userId: string;
  status: string;
  paymentMethod: 'RAZORPAY' | 'COD';
  isB2B: boolean;
  gstin: string | null;
  companyName: string | null;
  subtotal: number;
  discountAmount: number;
  couponCode: string | null;
  bundleDiscount: number;
  bundleName: string | null;
  shippingAmount: number;
  codFee: number;
  gstAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  totalAmount: number;
  deliveryName: string;
  deliveryPhone: string;
  deliveryLine1: string;
  deliveryLine2: string | null;
  deliveryCity: string;
  deliveryState: string;
  deliveryPincode: string;
  customerNote: string | null;
  createdAt: Date;
  estimatedDeliveryAt: Date;
  items: { skuId: string; productName: string; variantName: string; skuCode: string; hsnCode: string; quantity: number; unitPrice: number; taxRate: number; taxAmount: number; totalPrice: number; serial: boolean }[];
  couponId: string | null;
  couponDiscount: number;
  paymentStatus: string;
  paymentEvents: string[];
  shipment: null | { status: string; courier: string; awb: string; dispatchedAt: Date; deliveredAt: Date | null };
  returnInfo: null | { reason: string; status: string; isRma: boolean; refundAmount: number; inward: boolean };
}

async function main() {
  console.log('🌱 Seeding Patel Networks catalog…');

  // Clean in dependency order
  // (Postgres enforces FKs strictly — stock-monitor + OTP tables must be
  // cleared before their users/SKUs disappear. Keeps reseed idempotent.)
  await prisma.otpVerification.deleteMany();
  await prisma.stockCountLine.deleteMany();
  await prisma.stockAdjustmentRequest.deleteMany();
  await prisma.stockCountSession.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.shipmentEvent.deleteMany();
  await prisma.shipment.deleteMany();
  await prisma.paymentEvent.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.orderStatusHistory.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.orderReturn.deleteMany();
  await prisma.order.deleteMany();
  await prisma.couponRedemption.deleteMany();
  await prisma.coupon.deleteMany();
  await prisma.cartItem.deleteMany();
  await prisma.cart.deleteMany();
  await prisma.wishlistItem.deleteMany();
  await prisma.wishlist.deleteMany();
  await prisma.review.deleteMany();
  await prisma.bundleItem.deleteMany();
  await prisma.bundle.deleteMany();
  await prisma.inventoryMovement.deleteMany();
  await prisma.inventory.deleteMany();
  await prisma.productVariant.deleteMany();
  await prisma.sku.deleteMany();
  await prisma.productImage.deleteMany();
  await prisma.product.deleteMany();
  await prisma.brand.deleteMany();
  await prisma.category.deleteMany();
  await prisma.post.deleteMany();
  await prisma.banner.deleteMany();
  await prisma.address.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.user.deleteMany();
  await prisma.setting.deleteMany();
  await prisma.b2BInquiry.deleteMany();
  console.log('🧹 Cleaned');

  // ---------------- users ----------------
  // D-12 account model: SUPER_ADMIN (Owner, implicitly full) + STAFF whose
  // scope is a granted `permissions` list (set via the /admin/staff wizard).
  const adminPass = process.env.ADMIN_PASSWORD ?? 'patel@admin2026';
  const admin = await prisma.user.create({
    data: {
      phone: '+919899000001',
      email: (process.env.ADMIN_EMAIL ?? 'superadmin@patelnetworks.in').toLowerCase(),
      fullName: 'Store Owner',
      role: 'SUPER_ADMIN',
      passwordHash: hashPassword(adminPass),
    },
  });
  // staff accounts (scoped personas)
  const staffWarehouse = await prisma.user.create({
    data: {
      phone: '+919899000002',
      email: 'inventory@patelnetworks.in',
      fullName: 'Warehouse Desk',
      role: 'STAFF',
      permissions: ['inventory', 'stock_monitor', 'products'],
      passwordHash: hashPassword('warehouse@2026'),
    },
  });
  const staffFulfillment = await prisma.user.create({
    data: {
      phone: '+919899000003',
      email: 'orders@patelnetworks.in',
      fullName: 'Fulfillment Desk',
      role: 'STAFF',
      permissions: ['orders', 'returns'],
      passwordHash: hashPassword('fulfill@2026'),
    },
  });
  const staffContent = await prisma.user.create({
    data: {
      phone: '+919899000005',
      email: 'content@patelnetworks.in',
      fullName: 'Content Desk',
      role: 'STAFF',
      permissions: ['banners', 'blog', 'coupons'],
      passwordHash: hashPassword('content@2026'),
    },
  });
  // counter staff — Stock Monitor persona (ADR-010): observe & report only
  const staffCounter = await prisma.user.create({
    data: {
      phone: '+919899000004',
      email: 'staff@patelnetworks.in',
      fullName: 'Counter Staff',
      role: 'STAFF',
      permissions: ['stock_monitor'],
      passwordHash: hashPassword('counter@2026'),
    },
  });
  console.log('👤 Admin:', admin.email);
  console.log('👤 Staff (warehouse): inventory@patelnetworks.in / warehouse@2026');
  console.log('👤 Staff (fulfillment): orders@patelnetworks.in / fulfill@2026');
  console.log('👤 Staff (content): content@patelnetworks.in / content@2026');
  console.log('👤 Staff (counter): staff@patelnetworks.in / counter@2026');

  const customer = await prisma.user.create({
    data: {
      phone: '+919876543210',
      fullName: 'Rajesh Contractor',
      role: 'CUSTOMER',
      customer: {
        create: {
          fullName: 'Rajesh Contractor',
          companyName: 'Shreeji Electricals',
          gstin: '24AABCS1429B1Z5',
          isB2BVerified: true,
          addresses: {
            create: {
              recipientName: 'Rajesh Contractor',
              phone: '+919876543210',
              addressLine1: '12, Ring Road, Adajan',
              city: 'Surat',
              state: 'Gujarat',
              pincode: '395009',
              isDefault: true,
              type: 'WAREHOUSE',
            },
          },
        },
      },
    },
  });
  console.log('👤 Test customer:', customer.phone, '(B2B)');

  // ---------------- categories ----------------
  const catCctv = await prisma.category.create({
    data: { name: 'CCTV & Surveillance', slug: 'cctv-surveillance', description: 'HD Analog & IP cameras, DVRs, NVRs and surveillance storage', hsnCode: '8525', gstRate: 18, sortOrder: 1, imageUrl: img('dome') },
  });
  const subHd = await prisma.category.create({ data: { name: 'HD Analog Cameras', slug: 'hd-analog-cameras', parentId: catCctv.id, hsnCode: '8525', sortOrder: 1, imageUrl: '/images/seed/dome/02.png' } });
  const subIp = await prisma.category.create({ data: { name: 'Network (IP) Cameras', slug: 'ip-network-cameras', parentId: catCctv.id, hsnCode: '8525', sortOrder: 2, imageUrl: '/images/seed/bullet/01.png' } });
  const subDvr = await prisma.category.create({ data: { name: 'DVR / NVR Recorders', slug: 'dvr-nvr-recorders', parentId: catCctv.id, hsnCode: '8525', sortOrder: 3, imageUrl: '/images/seed/dvr/01.png' } });
  const subHdd = await prisma.category.create({ data: { name: 'Surveillance Storage', slug: 'surveillance-storage', parentId: catCctv.id, hsnCode: '8471', sortOrder: 4, imageUrl: '/images/seed/hdd/01.png' } });

  const catScreens = await prisma.category.create({
    data: { name: 'Displays & Screens', slug: 'displays-screens', description: '24/7-rated surveillance monitors and commercial displays', hsnCode: '8528', gstRate: 18, sortOrder: 2, imageUrl: img('monitor') },
  });

  const catCables = await prisma.category.create({
    data: { name: 'Cables & Wiring', slug: 'cables-wiring', description: 'Coaxial HD cables and structured Cat6/Cat6A ethernet', hsnCode: '8544', gstRate: 18, sortOrder: 3, imageUrl: img('cat6') },
  });
  const subCoax = await prisma.category.create({ data: { name: 'HD CCTV Coaxial Cable', slug: 'cctv-coaxial-cable', parentId: catCables.id, hsnCode: '8544', sortOrder: 1, imageUrl: '/images/seed/coax/01.jpg' } });
  const subNet = await prisma.category.create({ data: { name: 'Network Ethernet Cable', slug: 'ethernet-cable', parentId: catCables.id, hsnCode: '8544', sortOrder: 2, imageUrl: '/images/seed/cat6/01.jpg' } });

  const catConnectors = await prisma.category.create({
    data: { name: 'Connectors & Accessories', slug: 'connectors-accessories', description: 'BNC, DC, RJ45, keystone jacks and installation hardware', hsnCode: '8536', gstRate: 18, sortOrder: 4, imageUrl: img('connector') },
  });

  const catOptical = await prisma.category.create({
    data: { name: 'Media Converters & Optical', slug: 'media-converters-optical', description: 'Fiber media converters, SFP modules and patch cords', hsnCode: '8517', gstRate: 18, sortOrder: 5, imageUrl: img('fiber') },
  });
  console.log('🗂️ Categories');

  // ---------------- brands ----------------
  const brandData = [
    { name: 'CP Plus', slug: 'cp-plus', description: 'Leading Indian surveillance and security systems brand' },
    { name: 'Hikvision', slug: 'hikvision', description: 'World leader in video surveillance and AcuSense AI cameras' },
    { name: 'Dahua', slug: 'dahua', description: 'Advanced video surveillance and full-color imaging solutions' },
    { name: 'MTC', slug: 'mtc', description: 'High-grade analog HD cameras, cables and connectors' },
    { name: 'D-Link', slug: 'd-link', description: 'Industry-standard networking, Cat6 cables and switches' },
    { name: 'DGSoal', slug: 'dgsoal', description: 'Durable networking cables and connectors' },
    { name: 'Axpial', slug: 'axpial', description: 'Precision CCTV hardware accessories and BNC joints' },
    { name: 'Optilink', slug: 'optilink', description: 'Optical fiber media converters and transceivers' },
    { name: 'Lapcare', slug: 'lapcare', description: 'Reliable commercial surveillance screens and peripherals' },
    { name: 'AOC', slug: 'aoc', description: 'High-definition 24/7 security monitoring displays' },
  ];
  const brands: Record<string, string> = {};
  for (const b of brandData) {
    const created = await prisma.brand.create({ data: { ...b, logoUrl: undefined } });
    brands[b.slug] = created.id;
  }
  console.log('🏷️ Brands:', brandData.length);

  // ---------------- products ----------------
  interface VariantSpec {
    name: string;
    attributes: Record<string, string>;
    code: string;
    mrp: number; // rupees
    price: number; // rupees
    stock: number;
    cod?: boolean;
  }
  interface ProductSpec {
    name: string;
    slug: string;
    brand: string;
    categoryId: string;
    modelNumber: string;
    shortDesc: string;
    description: string;
    imageKey: string;
    isCodAllowed?: boolean;
    isFeatured?: boolean;
    warrantyMonths?: number;
    specs: [string, string][];
    variants: VariantSpec[];
  }

  const products: ProductSpec[] = [
    {
      name: 'CP Plus IR Bullet Camera — 2MP / 4MP / 8MP',
      slug: 'cp-plus-ir-bullet-camera',
      brand: 'cp-plus',
      categoryId: subHd.id,
      modelNumber: 'CP-USC-DA24L2',
      shortDesc: 'Weatherproof IR bullet camera family in 2MP, 4MP and 8MP (4K) tiers with 3.6mm lens.',
      description:
        'The CP Plus IR bullet family covers everyday shop, warehouse and perimeter coverage with three resolution tiers — 2MP (1080p), 4MP (2K) and 8MP (4K UHD). Fixed 3.6mm lens, smart IR night vision up to 30m and IP67 weatherproof housing for outdoor wall mounting. Works with all HD analog DVRs ( HDCVI / AHD / TVI / CVBS ) and supports audio on selected variants.',
      imageKey: 'bullet',
      isFeatured: true,
      warrantyMonths: 24,
      specs: [
        ['Sensor', '1/2.7" CMOS'],
        ['Lens', '3.6mm fixed'],
        ['Night vision', 'Smart IR up to 30m'],
        ['Housing', 'IP67 weatherproof bullet'],
        ['Video output', 'HDCVI / AHD / TVI / CVBS switchable'],
        ['Audio', 'Built-in mic (4MP ColorVu variant)'],
      ],
      variants: [
        { name: '2MP · 3.6mm · Bullet · IR', attributes: { Resolution: '2MP', Lens: '3.6mm', 'Form Factor': 'Bullet', 'Night Vision': 'IR' }, code: 'CPP-B01-2MP-36', mrp: 2800, price: 1450, stock: 45, cod: true },
        { name: '4MP · 3.6mm · Bullet · ColorVu', attributes: { Resolution: '4MP', Lens: '3.6mm', 'Form Factor': 'Bullet', 'Night Vision': 'ColorVu' }, code: 'CPP-B01-4MP-CV', mrp: 4200, price: 2350, stock: 20, cod: true },
        { name: '8MP · 2.8mm · Bullet · 4K UHD', attributes: { Resolution: '8MP', Lens: '2.8mm', 'Form Factor': 'Bullet', 'Night Vision': 'IR' }, code: 'CPP-B01-8MP-28', mrp: 8500, price: 4890, stock: 8, cod: false },
      ],
    },
    {
      name: 'CP Plus IR Dome Camera — 2MP / 4MP',
      slug: 'cp-plus-ir-dome-camera',
      brand: 'cp-plus',
      categoryId: subHd.id,
      modelNumber: 'CP-USC-DA24L2-V3',
      shortDesc: 'Indoor ceiling-mount dome cameras with smart IR, 2MP and 4MP tiers.',
      description:
        'Compact indoor dome cameras for counters, offices and corridors. 3.6mm wide-angle lens, discreet ceiling mount and smart IR illumination. Pairs with the same HD analog DVR line as the bullet family so mixed deployments stay on a single recorder.',
      imageKey: 'dome',
      isFeatured: true,
      warrantyMonths: 24,
      specs: [
        ['Sensor', '1/2.7" CMOS'],
        ['Lens', '3.6mm fixed'],
        ['Night vision', 'Smart IR up to 20m'],
        ['Housing', 'Indoor dome, ceiling mount'],
        ['Video output', 'HDCVI / AHD / TVI / CVBS switchable'],
      ],
      variants: [
        { name: '2MP · 3.6mm · Dome · IR', attributes: { Resolution: '2MP', Lens: '3.6mm', 'Form Factor': 'Dome' }, code: 'CPP-D01-2MP-36', mrp: 2200, price: 1180, stock: 60, cod: true },
        { name: '4MP · 2.8mm · Dome · IR', attributes: { Resolution: '4MP', Lens: '2.8mm', 'Form Factor': 'Dome' }, code: 'CPP-D01-4MP-28', mrp: 3600, price: 1990, stock: 32, cod: true },
      ],
    },
    {
      name: 'Hikvision AcuSense IP Bullet Camera — 4MP / 8MP PoE',
      slug: 'hikvision-acusense-ip-bullet',
      brand: 'hikvision',
      categoryId: subIp.id,
      modelNumber: 'DS-2CD2143G2-I',
      shortDesc: 'PoE network bullet cameras with AcuSense human/vehicle classification.',
      description:
        'Hikvision AcuSense network cameras classify humans and vehicles in real time to cut false alarms from rain, insects and foliage. PoE powered (802.3af), H.265+ compression and IP67 rated. Ideal for gated communities, factories and offices wired with Cat6.',
      imageKey: 'bullet',
      isFeatured: true,
      warrantyMonths: 24,
      specs: [
        ['Resolution', '4MP / 8MP tiers'],
        ['AI', 'AcuSense human & vehicle classification'],
        ['Power', 'PoE 802.3af / 12V DC'],
        ['Compression', 'H.265+'],
        ['Housing', 'IP67 bullet'],
      ],
      variants: [
        { name: '4MP · 4mm · Bullet · PoE', attributes: { Resolution: '4MP', Lens: '4mm', 'Form Factor': 'Bullet', Power: 'PoE' }, code: 'HIK-IP-4MP-4MM', mrp: 9500, price: 6450, stock: 18, cod: true },
        { name: '8MP · 2.8mm · Bullet · PoE', attributes: { Resolution: '8MP', Lens: '2.8mm', 'Form Factor': 'Bullet', Power: 'PoE' }, code: 'HIK-IP-8MP-28', mrp: 15500, price: 10990, stock: 9, cod: false },
      ],
    },
    {
      name: 'CP Plus 8-Channel HD DVR (HDCVI/AHD/TVI/CVBS)',
      slug: 'cp-plus-8ch-hd-dvr',
      brand: 'cp-plus',
      categoryId: subDvr.id,
      modelNumber: 'CP-UVR-0801E1-S',
      shortDesc: '8-channel 5MP-lite hybrid DVR with mobile viewing and cloud remote access.',
      description:
        'Hybrid 8-channel DVR supporting HDCVI, AHD, TVI, IP and analog cameras. H.264+ dual-stream recording, up to 10TB surveillance HDD, mobile app viewing and instant motion alerts. The workhorse recorder for shops, offices and small factories.',
      imageKey: 'dvr',
      isFeatured: true,
      warrantyMonths: 24,
      specs: [
        ['Channels', '8 (analog + up to 4 IP)'],
        ['Max recording', '5MP Lite'],
        ['Storage', '1 × SATA up to 10TB'],
        ['Remote', 'iCMOB / gCMOB mobile apps, cloud P2P'],
        ['Video out', 'HDMI + VGA'],
      ],
      variants: [
        { name: '8-Channel · 5MP Lite', attributes: { Channels: '8-CH', Type: 'DVR (HD Analog)' }, code: 'CPP-DVR-8CH', mrp: 7500, price: 4590, stock: 24, cod: true },
      ],
    },
    {
      name: 'Hikvision 16-Channel PoE NVR',
      slug: 'hikvision-16ch-poe-nvr',
      brand: 'hikvision',
      categoryId: subDvr.id,
      modelNumber: 'DS-7616NI-K2/16P',
      shortDesc: '16-channel NVR with 16 integrated PoE ports and 4K HDMI output.',
      description:
        'Enterprise-grade NVR with built-in 16-port PoE for clean single-cable IP camera deployments. Records up to 8MP per channel, supports dual SATA HDDs and H.265+ compression. Prepaid-only due to high value (selective COD policy).',
      imageKey: 'nvr',
      isCodAllowed: false,
      warrantyMonths: 24,
      specs: [
        ['Channels', '16 IP + 16 PoE'],
        ['Recording', 'Up to 8MP per channel'],
        ['Storage', '2 × SATA up to 10TB each'],
        ['Video out', '4K HDMI + VGA'],
        ['Power', 'PoE budget 120W'],
      ],
      variants: [
        { name: '16-Channel · 16 PoE · 4K', attributes: { Channels: '16-CH', Type: 'NVR (IP)', Power: 'PoE' }, code: 'HIK-NVR-16CH', mrp: 28500, price: 21990, stock: 6, cod: false },
      ],
    },
    {
      name: 'WD Purple Surveillance Hard Drive — 1TB / 2TB / 4TB',
      slug: 'wd-purple-surveillance-hdd',
      brand: 'hikvision',
      categoryId: subHdd.id,
      modelNumber: 'WD22PURZ',
      shortDesc: '24/7 surveillance-rated drives with AllFrame AI technology. 3-year warranty.',
      description:
        'Western Digital Purple drives are engineered for continuous CCTV recording workloads with AllFrame technology that reduces frame loss. Tiers: 1TB (~15–30 days retention for a 4-camera 2MP setup), 2TB, 4TB. 3-year manufacturer warranty.',
      imageKey: 'hdd',
      isFeatured: true,
      warrantyMonths: 36,
      specs: [
        ['Class', 'Surveillance 24/7'],
        ['Technology', 'AllFrame AI'],
        ['Warranty', '3 years'],
        ['Compatibility', 'DVR / NVR SATA bays'],
      ],
      variants: [
        { name: '1TB · WD Purple', attributes: { Storage: '1TB', Brand: 'Western Digital' }, code: 'WDP-HDD-1TB', mrp: 4600, price: 3190, stock: 30, cod: true },
        { name: '2TB · WD Purple', attributes: { Storage: '2TB', Brand: 'Western Digital' }, code: 'WDP-HDD-2TB', mrp: 6900, price: 4890, stock: 22, cod: true },
        { name: '4TB · WD Purple', attributes: { Storage: '4TB', Brand: 'Western Digital' }, code: 'WDP-HDD-4TB', mrp: 11500, price: 8590, stock: 12, cod: false },
      ],
    },
    {
      name: 'AOC 24" Surveillance Monitor',
      slug: 'aoc-24-surveillance-monitor',
      brand: 'aoc',
      categoryId: catScreens.id,
      modelNumber: '24B1XHS',
      shortDesc: '23.8" Full-HD IPS monitor suited for 24/7 monitoring walls.',
      description:
        'Full-HD IPS panel with wide viewing angles for monitoring desks. Flicker-free and low-blue-light rated for long control-room shifts. HDMI + VGA inputs pair directly with DVR/NVR outputs.',
      imageKey: 'monitor',
      isFeatured: true,
      warrantyMonths: 36,
      specs: [
        ['Panel', '23.8" IPS Full HD'],
        ['Inputs', 'HDMI 1.4 ×2, VGA'],
        ['Rating', 'Flicker-free, low blue light'],
        ['Mount', 'VESA 100'],
      ],
      variants: [
        { name: '23.8" · Full HD · IPS', attributes: { Size: '24"', Resolution: 'FHD' }, code: 'AOC-MON-24FHD', mrp: 11500, price: 7690, stock: 14, cod: false },
      ],
    },
    {
      name: 'Lapcare 22" HD Surveillance Monitor',
      slug: 'lapcare-22-hd-monitor',
      brand: 'lapcare',
      categoryId: catScreens.id,
      modelNumber: 'LAP-22MS',
      shortDesc: 'Compact 21.5" HD monitor for counter and small-shop CCTV viewing.',
      description:
        'Value-tier 21.5" HD monitor for single-recorder retail setups. HDMI + VGA inputs, slim bezel and wall-mount support.',
      imageKey: 'monitor',
      warrantyMonths: 12,
      specs: [
        ['Panel', '21.5" TN HD+'],
        ['Inputs', 'HDMI, VGA'],
        ['Mount', 'VESA 75'],
      ],
      variants: [
        { name: '21.5" · HD+ · TN', attributes: { Size: '22"', Resolution: 'HD+' }, code: 'LAP-MON-22HD', mrp: 7500, price: 4990, stock: 20, cod: true },
      ],
    },
    {
      name: 'CP Plus HD Coaxial Cable 3+1 — 90m / 180m / 305m',
      slug: 'cp-plus-hd-coaxial-cable-3-plus-1',
      brand: 'cp-plus',
      categoryId: subCoax.id,
      modelNumber: 'CPL-CBL3P1',
      shortDesc: 'Solid-copper 3+1 coaxial power-video combo cable for HD analog CCTV.',
      description:
        'Pure-copper 3+1 composite cable carrying video plus DC power in one jacket. Available in 90m box, 180m box and 305m drum for full-site runs. The 305m drum is bulky and therefore prepaid-only under the selective COD policy.',
      imageKey: 'coax',
      isFeatured: true,
      warrantyMonths: 12,
      specs: [
        ['Construction', '3+1 (video + 3 power cores)'],
        ['Conductor', 'Solid pure copper'],
        ['Shield', '125% braided'],
        ['Jacket', 'UV-stabilized PVC'],
      ],
      variants: [
        { name: '90 metre box', attributes: { Length: '90m', Core: '3+1' }, code: 'CPP-CBL-90M', mrp: 3200, price: 1890, stock: 40, cod: true },
        { name: '180 metre box', attributes: { Length: '180m', Core: '3+1' }, code: 'CPP-CBL-180M', mrp: 5900, price: 3590, stock: 25, cod: true },
        { name: '305 metre drum', attributes: { Length: '305m', Core: '3+1' }, code: 'DL-C6-305M', mrp: 9800, price: 6290, stock: 10, cod: false },
      ],
    },
    {
      name: 'D-Link Cat6 Ethernet Cable — 90m / 305m',
      slug: 'd-link-cat6-ethernet-cable',
      brand: 'd-link',
      categoryId: subNet.id,
      modelNumber: 'NCB-C6UGRYR-305',
      shortDesc: 'Gigabit solid-copper Cat6 UTP cable for IP cameras and PoE runs.',
      description:
        'Pure-copper Cat6 UTP rated 250MHz for gigabit PoE camera runs up to 90m per channel. Jacket options: 90m easy-pull box and 305m drum.',
      imageKey: 'cat6',
      warrantyMonths: 12,
      specs: [
        ['Category', 'Cat6 UTP 250MHz'],
        ['Conductor', '23 AWG solid copper'],
        ['PoE', '802.3af/at compatible'],
        ['Rating', 'Gigabit'],
      ],
      variants: [
        { name: '90 metre box', attributes: { Length: '90m', Category: 'Cat6' }, code: 'DL-C6-90M', mrp: 2900, price: 1790, stock: 45, cod: true },
        { name: '305 metre drum', attributes: { Length: '305m', Category: 'Cat6' }, code: 'DL-C6-305-DRUM', mrp: 8500, price: 5490, stock: 16, cod: false },
      ],
    },
    {
      name: 'Axpial BNC + DC Connector Pack (10 pairs)',
      slug: 'axpial-bnc-dc-connector-pack',
      brand: 'axpial',
      categoryId: catConnectors.id,
      modelNumber: 'AXP-BNCD-10',
      shortDesc: 'Solderless BNC video + DC power connectors, 10 pairs per pack.',
      description:
        'Brass-core solderless BNC connectors with matching DC power plugs and pigtails — the standard termination kit for 3+1 coaxial CCTV cable. 10 pairs per pack.',
      imageKey: 'connector',
      warrantyMonths: 6,
      specs: [
        ['Type', 'BNC male + DC male'],
        ['Termination', 'Solderless screw'],
        ['Pack', '10 pairs'],
      ],
      variants: [
        { name: 'Pack of 10 pairs', attributes: { Pack: '10 pairs' }, code: 'AXP-BNCD-10', mrp: 450, price: 249, stock: 120, cod: true },
      ],
    },
    {
      name: 'MTC RJ45 Cat6 Keystone Jack & Plug Kit',
      slug: 'mtc-rj45-cat6-keystone-kit',
      brand: 'mtc',
      categoryId: catConnectors.id,
      modelNumber: 'MTC-RJ45-K20',
      shortDesc: 'Tool-less keystone jacks and Cat6 RJ45 plugs, 20-piece kit.',
      description:
        'Complete termination kit for Cat6 structured cabling: 10 tool-less keystone jacks and 10 pass-through RJ45 plugs. Works with standard 19" patch panels and surface boxes.',
      imageKey: 'connector',
      warrantyMonths: 6,
      specs: [
        ['Type', 'Keystone jack + RJ45 plug'],
        ['Category', 'Cat6'],
        ['Pack', '10 + 10'],
      ],
      variants: [
        { name: 'Kit of 20 pieces', attributes: { Pack: '20 pieces' }, code: 'MTC-RJ45-K20', mrp: 650, price: 349, stock: 80, cod: true },
      ],
    },
    {
      name: 'Optilink Gigabit Fiber Media Converter — Single Mode 20km',
      slug: 'optilink-gigabit-fiber-media-converter',
      brand: 'optilink',
      categoryId: catOptical.id,
      modelNumber: 'OPL-CONV-SM20',
      shortDesc: '10/100/1000Base-TX to single-mode SC fiber converter, 20km.',
      description:
        'Rack-mountable gigabit media converter for linking NVR clusters across campuses on single-mode fiber up to 20km. Auto-negotiating RJ45 with SC optical port and external power adapter.',
      imageKey: 'fiber',
      isFeatured: true,
      warrantyMonths: 12,
      specs: [
        ['Copper', '10/100/1000Base-TX RJ45'],
        ['Optical', '1000Base-LX SC single-mode'],
        ['Distance', 'Up to 20km'],
        ['Power', 'DC 5V adapter included'],
      ],
      variants: [
        { name: 'Single-mode · 20km', attributes: { Fiber: 'Single-mode', Distance: '20km' }, code: 'OPL-CONV-SM20', mrp: 5500, price: 3490, stock: 18, cod: true },
      ],
    },
    {
      name: 'D-Link 8-Port Gigabit PoE Switch (65W)',
      slug: 'd-link-8port-gigabit-poe-switch',
      brand: 'd-link',
      categoryId: subIp.id,
      modelNumber: 'DGS-F1008P-E',
      shortDesc: '8 × gigabit PoE+ ports with 65W budget — power up to 8 IP cameras.',
      description:
        'Unmanaged gigabit PoE switch with 65W total budget, powering up to eight 4MP IP cameras on a single Cat6 run each. Fanless metal housing for wall or desk.',
      imageKey: 'poe',
      warrantyMonths: 24,
      specs: [
        ['Ports', '8 × Gigabit PoE+'],
        ['PoE budget', '65W total'],
        ['Housing', 'Fanless metal'],
        ['Mount', 'Wall / desk'],
      ],
      variants: [
        { name: '8-Port · 65W', attributes: { Ports: '8', PoE: '65W' }, code: 'DL-POE-8P-65W', mrp: 6900, price: 4590, stock: 21, cod: true },
      ],
    },
  ];

  const skuToId: Record<string, string> = {};
  const productIds: Record<string, string> = {};

  for (const p of products) {
    const brandId = brands[p.brand];
    const created = await prisma.product.create({
      data: {
        name: p.name,
        slug: p.slug,
        brandId,
        categoryId: p.categoryId,
        shortDesc: p.shortDesc,
        description: p.description,
        modelNumber: p.modelNumber,
        isCodAllowed: p.isCodAllowed ?? true,
        isFeatured: p.isFeatured ?? false,
        warrantyMonths: p.warrantyMonths ?? 12,
        specifications: JSON.stringify(Object.fromEntries(p.specs)),
        metaTitle: `${p.name} — Price in India`,
        metaDescription: p.shortDesc,
        images: {
          // de-duplicate: image banks may hold fewer than 3 shots per key —
          // never create identical gallery entries for single-image banks
          create: [img(p.imageKey), img(p.imageKey), img(p.imageKey)]
            .filter((u): u is string => Boolean(u))
            .filter((u, i, arr) => arr.indexOf(u) === i)
            .map((url, i) => ({ url, altText: `${p.name} — view ${i + 1}`, sortOrder: i })),
        },
      },
    });
    productIds[p.slug] = created.id;

    let vOrder = 0;
    for (const v of p.variants) {
      const sku = await prisma.sku.create({
        data: {
          code: v.code,
          mrp: v.mrp * 100,
          sellingPrice: v.price * 100,
          weightGrams: v.code.includes('DRUM') || v.code.includes('305') ? 5000 : 500,
          dimensions: JSON.stringify({ l: 20, w: 15, h: 10 }),
        },
      });
      await prisma.productVariant.create({
        data: {
          productId: created.id,
          name: v.name,
          attributes: JSON.stringify(v.attributes),
          skuId: sku.id,
          sortOrder: vOrder++,
        },
      });
      await prisma.inventory.create({
        data: { skuId: sku.id, currentStock: v.stock, reservedStock: 0, lowStockThreshold: 5 },
      });
      await prisma.inventoryMovement.create({
        data: { skuId: sku.id, quantity: v.stock, reason: 'PURCHASE_RECEIPT', notes: 'Initial seed intake', referenceId: 'SEED-INTAKE' },
      });
      skuToId[v.code] = sku.id;
    }
  }
  console.log('📦 Products:', products.length, '· SKUs:', Object.keys(skuToId).length);

  // ---------------- inventory demo states (low / out of stock) ----------------
  // Deterministic post-pass so the ops console shows real LOW/OUT rows, the
  // dashboard low-stock panel has data, and one PDP demonstrates OOS + the
  // back-in-stock alert opt-in.
  const demoStates: { code: string; stock: number }[] = [
    { code: 'HIK-IP-8MP-28', stock: 0 }, // out of stock
    { code: 'HIK-NVR-16CH', stock: 3 }, // low (threshold 5)
    { code: 'CPP-B01-8MP-28', stock: 4 }, // low (threshold 5)
  ];
  for (const s of demoStates) {
    const skuId = skuToId[s.code];
    if (!skuId) continue;
    const inv = await prisma.inventory.findUnique({ where: { skuId } });
    if (!inv || inv.currentStock === s.stock) continue;
    await prisma.inventory.update({ where: { skuId }, data: { currentStock: s.stock } });
    await prisma.inventoryMovement.create({
      data: { skuId, quantity: s.stock - inv.currentStock, reason: 'MANUAL_ADJUSTMENT', notes: 'Seed demo: low/out-of-stock state', referenceId: 'SEED-DEMO' },
    });
  }

  // ---------------- kit-builder bundle (ADR-006) ----------------
  const bundle = await prisma.bundle.create({
    data: {
      name: 'Custom CCTV Kit',
      slug: 'custom-cctv-kit',
      description: '5-step guided kit: recorder + cameras + HDD + power & cable. Automatic 5% bundle discount.',
      discountPct: 5,
      items: {
        create: [
          { skuId: skuToId['CPP-DVR-8CH'], slot: 'recorder', quantity: 1 },
          { skuId: skuToId['HIK-NVR-16CH'], slot: 'recorder', quantity: 1 },
          { skuId: skuToId['CPP-B01-2MP-36'], slot: 'camera', quantity: 1 },
          { skuId: skuToId['CPP-D01-2MP-36'], slot: 'camera', quantity: 1 },
          { skuId: skuToId['WDP-HDD-1TB'], slot: 'hdd', quantity: 1 },
          { skuId: skuToId['WDP-HDD-2TB'], slot: 'hdd', quantity: 1 },
          { skuId: skuToId['CPP-CBL-90M'], slot: 'cable', quantity: 1 },
          { skuId: skuToId['AXP-BNCD-10'], slot: 'connector', quantity: 1 },
          { skuId: skuToId['MTC-RJ45-K20'], slot: 'connector', quantity: 1 },
        ],
      },
    },
  });
  console.log('🎁 Kit bundle:', bundle.slug);

  // ---------------- coupons ----------------
  await prisma.coupon.createMany({
    data: [
      { code: 'WELCOME5', description: '5% off your first order (max ₹500)', type: 'PERCENT', value: 5, maxDiscountValue: 50000, minOrderValue: 100000, usageLimit: 500 },
      { code: 'INSTALLER10', description: '10% off orders above ₹25,000 for contractors (max ₹2,500)', type: 'PERCENT', value: 10, maxDiscountValue: 250000, minOrderValue: 2500000, usageLimit: 200 },
      { code: 'CABLE200', description: '₹200 off cable orders above ₹2,000', type: 'FIXED', value: 20000, minOrderValue: 200000, usageLimit: 300 },
    ],
  });
  console.log('🎟️ Coupons: 3');

  // ---------------- banners ----------------
  await prisma.banner.createMany({
    data: [
      {
        title: 'Surveillance hardware, specified right the first time',
        subtitle: 'Authorized Hikvision, Dahua & CP Plus distribution with GST invoices and serial-tracked warranty.',
        imageUrl: img('hero') ?? img('dome') ?? 'https://images.unsplash.com/photo-1558002038-1055907df827',
        linkUrl: '/products?category=cctv-surveillance',
        placement: 'HOME_HERO',
        sortOrder: 0,
      },
      {
        title: 'Build a complete kit in 5 steps',
        subtitle: 'Recorder + cameras + HDD + cable, with automatic 5% bundle discount.',
        imageUrl: img('fiber') ?? img('dvr') ?? 'https://images.unsplash.com/photo-1557597774-9d273605dfa9',
        linkUrl: '/kit-builder',
        placement: 'HOME_STRIP',
        sortOrder: 0,
      },
    ],
  });
  console.log('🖼️ Banners: 2');

  // ---------------- blog ----------------
  const posts = [
    {
      title: 'HD Analog vs IP: choosing the right camera system',
      slug: 'hd-analog-vs-ip-cameras',
      excerpt: 'Both technologies record crisp footage — the right choice depends on distance, cabling and budget. A practical installer-oriented comparison.',
      tags: ['buying-guide', 'cctv'],
      content:
        '## The short answer\n\nHD analog (HDCVI/AHD/TVI) sends uncompressed video over existing coaxial cable. IP cameras send compressed digital video over Cat6 ethernet and can carry power on the same cable via PoE.\n\n### Choose HD analog when\n- You already have coaxial cable in the walls\n- Coverage is under 300m per run\n- The budget is tight and the channel count is small (4–8 cameras)\n\n### Choose IP when\n- You need AI features (human/vehicle classification, line crossing)\n- Runs exceed 300m or must cross buildings (fiber media converters help)\n- You want one cable per camera doing power + video (PoE)\n\n### Storage mathematics\nA 2MP camera on H.265 records roughly 1GB per hour at motion-weighted settings: a 4-camera system on a 2TB WD Purple drive retains about 20–25 days. An 8MP (4K) camera quadruples that; plan 4TB or motion-only recording.\n\n### Bottom line\nFor shops and small offices, an 8-channel HD analog DVR with 2MP/4MP ColorVu cameras remains the best value. For factories, campuses and anywhere AI analytics matter, 4MP/8MP PoE IP cameras on a 16-channel NVR justify the premium.',
    },
    {
      title: 'How to size a surveillance hard drive (retention calculator)',
      slug: 'surveillance-hdd-retention-calculator',
      excerpt: 'How many days of footage will 1TB actually hold? A worked table for 2MP–8MP cameras at realistic bitrates.',
      tags: ['storage', 'hdd'],
      content:
        '## Bitrates first\n\nSurveillance recording is bitrate-driven. At H.265:\n- 2MP (1080p): ~1 Mbps average\n- 4MP (2K): ~2 Mbps\n- 8MP (4K): ~4 Mbps\n\n## The formula\n\nRetention (days) = (Drive GB × 8) ÷ (Bitrate Mbps × 3600 × 24 × Cameras ÷ 1000)\n\nOr practically:\n\n| Setup | 1TB | 2TB | 4TB |\n| --- | --- | --- | --- |\n| 2 × 2MP | ~20 days | ~40 days | ~80 days |\n| 4 × 2MP | ~10 days | ~20 days | ~40 days |\n| 4 × 4MP | ~5 days | ~10 days | ~20 days |\n| 8 × 4MP | ~2.5 days | ~5 days | ~10 days |\n\n## Use surveillance-rated drives only\n\nDesktop drives are not built for 24/7 write loads. WD Purple and Seagate SkyHawk drives are rated for continuous operation and AllFrame/Health Management features that reduce dropped frames — and they carry 3-year warranties.',
    },
    {
      title: 'Claiming GST input tax credit on security hardware',
      slug: 'gst-input-tax-credit-security-hardware',
      excerpt: 'Installers and businesses can recover the 18% GST on CCTV purchases. What your invoice must show.',
      tags: ['gst', 'b2b'],
      content:
        '## Who can claim input credit\n\nAny GST-registered business that buys surveillance hardware **for business use** — electrical contractors, system integrators, factories, offices, shops.\n\n## What the invoice must contain\n\n1. Your legal business name and 15-character GSTIN\n2. Supplier GSTIN (ours: 24AAACP1234F1Z8, Gujarat)\n3. HSN codes per line: 8525 for cameras/recorders, 8544 for cables, 8536 for connectors\n4. CGST+SGST split (intra-state Gujarat) or IGST (inter-state)\n\n## How it works on our checkout\n\nToggle **“Use GSTIN for business input tax credit”** at checkout, enter your business name and GSTIN, and the tax invoice is generated with your details. The credit appears in your GSTR-2B after we file GSTR-1.\n\n## Common mistakes\n\n- Personal-name orders cannot be re-billed later\n- PO-box style addresses without the delivery PIN code delay filings\n- Keep the serial numbers (we record them at dispatch) matched to the invoice for brand warranty claims.',
    },
  ];
  for (const p of posts) {
    await prisma.post.create({
      data: {
        title: p.title,
        slug: p.slug,
        excerpt: p.excerpt,
        content: p.content,
        status: 'PUBLISHED',
        publishedAt: new Date(),
        tags: JSON.stringify(p.tags),
        coverImageUrl: img(p.tags[0] === 'storage' ? 'hdd' : p.tags[0] === 'gst' ? 'monitor' : 'bullet'),
      },
    });
  }
  console.log('📰 Blog posts:', posts.length);

  // ---------------- reviews (approved, tied to test customer) ----------------
  await prisma.review.createMany({
    data: [
      { productId: productIds['cp-plus-ir-bullet-camera'], userId: customer.id, rating: 5, title: 'Solid night vision', comment: 'Installed six 2MP units around a warehouse. IR is clean to about 20m and the housing has survived two monsoons.', isApproved: true, isVerified: true },
      { productId: productIds['cp-plus-8ch-hd-dvr'], userId: customer.id, rating: 4, title: 'Dependable workhorse', comment: 'Mobile app setup took ten minutes. Playback search is fast on the 2TB Purple drive.', isApproved: true, isVerified: true },
      { productId: productIds['wd-purple-surveillance-hdd'], userId: customer.id, rating: 5, title: 'Quiet and reliable', comment: 'Zero dropped frames after eight months of 24/7 writes on four cameras.', isApproved: true, isVerified: true },
    ],
  });

  // ===================================================================
  // VOLUMETRIC SEED (Task 30) — realistic operating history for EVERY
  // table: 50 buyers, ~180 orders across all statuses & 6 months,
  // payments + gateway events, shipments + tracking events, returns,
  // coupon redemptions, reviews, carts, wishlists, stock alerts, B2B
  // inquiries, OTPs, audit trail and full stock-monitor lifecycle.
  // Deterministic (mulberry32) → identical dataset on every re-seed.
  // ===================================================================
  console.log('🏭 Volumetric seed: generating operating history…');

  // ---- 0. reload catalog as generator input -------------------------
  const skuRows = await prisma.sku.findMany({
    select: {
      id: true, code: true, sellingPrice: true, mrp: true,
      inventory: { select: { currentStock: true } },
      variant: {
        select: {
          name: true,
          product: { select: { id: true, name: true, slug: true, category: { select: { hsnCode: true, gstRate: true } } } },
        },
      },
    },
  });
  const salableSkus = skuRows.filter((s) => s.variant && (s.inventory?.currentStock ?? 0) > 0);
  const productMetaList = (() => {
    const m = new Map<string, { id: string; name: string; slug: string; hsn: string; gstRate: number; minPrice: number }>();
    for (const s of skuRows) {
      if (!s.variant) continue;
      const p = s.variant.product;
      const cur = m.get(p.id);
      if (cur) cur.minPrice = Math.min(cur.minPrice, s.sellingPrice);
      else m.set(p.id, { id: p.id, name: p.name, slug: p.slug, hsn: p.category.hsnCode, gstRate: p.category.gstRate, minPrice: s.sellingPrice });
    }
    return [...m.values()];
  })();
  const couponRows = await prisma.coupon.findMany();

  // ---- 1. buyers: 50 customers w/ profiles & 1–3 addresses ----------
  const CUSTOMER_COUNT = 50;
  const custUsers = await prisma.user.createManyAndReturn({
    data: Array.from({ length: CUSTOMER_COUNT }, (_, i) => {
      const at = daysAgo(4, 200);
      return { phone: `+91${9876500000 + (i + 1) * 137}`, fullName: `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`, role: 'CUSTOMER', createdAt: at, updatedAt: at };
    }),
  });
  const custProfiles = await prisma.customer.createManyAndReturn({
    data: custUsers.map((u, i) => {
      const b2b = rnd() < 0.6;
      return { userId: u.id, fullName: u.fullName!, companyName: b2b ? pick(COMPANIES) : null, gstin: b2b ? genGstin(i) : null, isB2BVerified: b2b, createdAt: u.createdAt, updatedAt: u.createdAt };
    }),
  });
  const addrRows: { customerId: string; recipientName: string; phone: string; addressLine1: string; addressLine2: string | null; city: string; state: string; pincode: string; isDefault: boolean; type: string; createdAt: Date; updatedAt: Date }[] = [];
  custProfiles.forEach((c, idx) => {
    const n = randInt(1, 3);
    for (let j = 0; j < n; j++) {
      const [city, state, pincode] = pick(CITIES);
      addrRows.push({ customerId: c.id, recipientName: c.fullName, phone: custUsers[idx].phone, addressLine1: pick(STREETS), addressLine2: rnd() < 0.5 ? pick(LANDMARKS) : null, city, state, pincode, isDefault: j === 0, type: pick(['HOME', 'WORK', 'WAREHOUSE']), createdAt: custUsers[idx].createdAt, updatedAt: custUsers[idx].createdAt });
    }
  });
  const addresses = await prisma.address.createManyAndReturn({ data: addrRows });
  const addrByCustomer = new Map<string, typeof addresses>();
  for (const a of addresses) {
    const list = addrByCustomer.get(a.customerId) ?? [];
    list.push(a);
    addrByCustomer.set(a.customerId, list);
  }
  const rajeshProfile = await prisma.customer.findUniqueOrThrow({ where: { userId: customer.id }, include: { addresses: true } });
  const buyers = [
    ...custProfiles.map((c, idx) => ({ userId: c.userId, name: c.fullName, phone: custUsers[idx].phone, isB2B: c.isB2BVerified, gstin: c.gstin, companyName: c.companyName, addrs: addrByCustomer.get(c.id) ?? [] })),
    { userId: customer.id, name: rajeshProfile.fullName, phone: customer.phone, isB2B: rajeshProfile.isB2BVerified, gstin: rajeshProfile.gstin, companyName: rajeshProfile.companyName, addrs: rajeshProfile.addresses },
  ];
  console.log('🧍 Buyers:', buyers.length, '· addresses:', addresses.length);

  // ---- 2. order blueprints ------------------------------------------
  const STATUS_PLAN: [string, number][] = [
    ['DELIVERED', 110], ['OUT_FOR_DELIVERY', 8], ['SHIPPED', 12], ['PACKED', 6], ['PROCESSING', 8],
    ['CONFIRMED', 6], ['PAID', 6], ['COD_PENDING', 6], ['PENDING_PAYMENT', 4], ['CANCELLED', 8],
    ['RETURN_REQUESTED', 2], ['RETURNED', 4], ['REFUNDED', 2],
  ];
  const statusBag: string[] = [];
  for (const [s, n] of STATUS_PLAN) for (let i = 0; i < n; i++) statusBag.push(s);
  for (let i = statusBag.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [statusBag[i], statusBag[j]] = [statusBag[j], statusBag[i]];
  }

  const RETURN_REASONS = ['DOA — dead on arrival', 'Damaged in transit', 'Wrong variant ordered', 'Not powering after install', 'Customer changed requirement'];
  const CANCEL_REASONS = ['Payment not received in time', 'Out of stock at confirmation', 'Customer changed requirement', 'Duplicate order'];

  function pickSkus(maxItems: number): OrderBlueprint['items'] {
    const items: OrderBlueprint['items'] = [];
    const used = new Set<string>();
    const n = randInt(1, maxItems);
    for (let i = 0; i < n; i++) {
      const s = pick(salableSkus);
      if (used.has(s.code)) continue;
      used.add(s.code);
      const v = s.variant!;
      const rate = v.product.category.gstRate;
      const isCable = /CBL|C6|DRUM/.test(s.code);
      const isConnector = /AXP|MTC/.test(s.code);
      const qty = isCable ? randInt(1, 6) : isConnector ? randInt(1, 10) : randInt(1, 4);
      const lineTotal = s.sellingPrice * qty;
      items.push({
        skuId: s.id, productName: v.product.name, variantName: v.name, skuCode: s.code, hsnCode: v.product.category.hsnCode,
        quantity: qty, unitPrice: s.sellingPrice, taxRate: rate,
        taxAmount: Math.round((lineTotal * rate) / (100 + rate)), totalPrice: lineTotal,
        serial: s.sellingPrice >= 300000,
      });
    }
    return items;
  }

  const blueprints: OrderBlueprint[] = statusBag.map((status, idx) => {
    const buyer = pick(buyers);
    const addr = pick(buyer.addrs.length ? buyer.addrs : buyers[buyers.length - 1].addrs);
    const paymentMethod: 'RAZORPAY' | 'COD' = rnd() < 0.3 ? 'COD' : 'RAZORPAY';
    const isReturn = ['RETURN_REQUESTED', 'RETURNED', 'REFUNDED'].includes(status);
    const minAge = status === 'DELIVERED' ? 8 : isReturn ? 25 : 0;
    const createdAt = daysAgo(minAge, 180);
    const items = pickSkus(randInt(1, 4));
    const subtotal = items.reduce((t, it) => t + it.totalPrice, 0);
    const gstAmount = items.reduce((t, it) => t + it.taxAmount, 0);

    let couponCode: string | null = null;
    let couponId: string | null = null;
    let discountAmount = 0;
    if (rnd() < 0.16) {
      const eligible = couponRows.filter((c) => c.isActive && (!c.minOrderValue || subtotal >= c.minOrderValue));
      if (eligible.length) {
        const c = pick(eligible);
        couponCode = c.code;
        couponId = c.id;
        discountAmount = c.type === 'PERCENT' ? Math.min(Math.round((subtotal * c.value) / 100), c.maxDiscountValue ?? Number.MAX_SAFE_INTEGER) : c.value;
      }
    }
    let bundleDiscount = 0;
    let bundleName: string | null = null;
    if (items.length >= 3 && rnd() < 0.1) {
      bundleDiscount = Math.round(subtotal * 0.05);
      bundleName = 'Custom CCTV Kit';
    }
    const shippingAmount = subtotal >= 500000 ? 0 : 14900;
    const codFee = paymentMethod === 'COD' ? 4900 : 0;
    const totalAmount = subtotal - discountAmount - bundleDiscount + shippingAmount + codFee;
    const guj = addr.state === 'Gujarat';
    const cgstAmount = guj ? Math.floor(gstAmount / 2) : 0;
    const sgstAmount = guj ? gstAmount - cgstAmount : 0;
    const igstAmount = guj ? 0 : gstAmount;

    // status history is synthesized in a second pass below (historyMap)
    const flowEnd = status === 'CANCELLED' ? randInt(2, 5) : STATUS_FLOW.indexOf(status);

    // payment
    let paymentStatus = 'SUCCESS';
    let paymentEvents: string[];
    if (status === 'PENDING_PAYMENT') { paymentStatus = 'INITIATED'; paymentEvents = ['payment.order_created']; }
    else if (status === 'COD_PENDING') { paymentStatus = 'INITIATED'; paymentEvents = ['cod.order_placed']; }
    else if (status === 'CANCELLED') { paymentStatus = paymentMethod === 'COD' || flowEnd < 1 ? 'INITIATED' : 'FAILED'; paymentEvents = paymentStatus === 'FAILED' ? ['payment.failed'] : ['payment.order_created']; }
    else if (status === 'REFUNDED') { paymentStatus = 'REFUNDED'; paymentEvents = ['payment.captured', 'refund.processed']; }
    else paymentEvents = paymentMethod === 'COD' ? ['cod.collect_on_delivery'] : ['payment.authorized', 'payment.captured'];

    // shipment (everything that reached SHIPPED+)
    let shipment: OrderBlueprint['shipment'] = null;
    if (STATUS_FLOW.indexOf(status) >= 5) {
      const dispatchedAt = addHours(createdAt, randInt(20, 40));
      const deliveredAt = ['SHIPPED', 'OUT_FOR_DELIVERY'].includes(status) ? null : addHours(dispatchedAt, randInt(48, 120));
      shipment = {
        status: status === 'SHIPPED' ? 'IN_TRANSIT' : status === 'OUT_FOR_DELIVERY' ? 'OUT_FOR_DELIVERY' : 'DELIVERED',
        courier: pick(COURIERS), awb: `AWB${1200000000 + idx}`, dispatchedAt,
        deliveredAt: deliveredAt && deliveredAt.getTime() > Date.now() ? new Date(Date.now() - 3600000) : deliveredAt,
      };
    }

    // returns
    let returnInfo: OrderBlueprint['returnInfo'] = null;
    if (status === 'RETURN_REQUESTED') returnInfo = { reason: pick(RETURN_REASONS), status: 'REQUESTED', isRma: false, refundAmount: 0, inward: false };
    else if (status === 'RETURNED') returnInfo = { reason: pick(RETURN_REASONS), status: 'RESTOCKED', isRma: true, refundAmount: 0, inward: true };
    else if (status === 'REFUNDED') returnInfo = { reason: pick(RETURN_REASONS), status: 'REFUNDED', isRma: true, refundAmount: totalAmount, inward: true };

    return {
      orderNumber: `PN-2026-${String(300000 + idx).padStart(6, '0')}`,
      userId: buyer.userId, status, paymentMethod,
      isB2B: buyer.isB2B, gstin: buyer.gstin, companyName: buyer.companyName,
      subtotal, discountAmount, couponCode, shippingAmount, codFee, gstAmount, cgstAmount, sgstAmount, igstAmount, totalAmount,
      deliveryName: addr.recipientName ?? buyer.name, deliveryPhone: addr.phone, deliveryLine1: addr.addressLine1,
      deliveryLine2: addr.addressLine2, deliveryCity: addr.city, deliveryState: addr.state, deliveryPincode: addr.pincode,
      customerNote: rnd() < 0.12 ? pick(NOTE_POOL) : null,
      createdAt, estimatedDeliveryAt: addDays(createdAt, randInt(3, 7)),
      items, couponId, couponDiscount: discountAmount, bundleDiscount, bundleName,
      paymentStatus, paymentEvents, shipment, returnInfo,
    };
  });
  // Second pass: synthesize OrderStatusHistory chains per blueprint.
  const historyMap = new Map<OrderBlueprint, { status: string; comment: string; changedBy: string; at: Date }[]>();
  for (const o of blueprints) {
    const flowEnd = o.status === 'CANCELLED' ? randInt(2, 5) : STATUS_FLOW.indexOf(o.status);
    const hh: { status: string; comment: string; changedBy: string; at: Date }[] = [];
    let t = o.createdAt;
    for (let step = 0; step <= flowEnd; step++) {
      const st = step === 1 && o.paymentMethod === 'COD' ? 'COD_PENDING' : STATUS_FLOW[step];
      t = addHours(t, randInt(2, 20));
      if (t.getTime() > Date.now()) t = new Date(Date.now() - 60000);
      hh.push({ status: st, comment: st === 'PENDING_PAYMENT' ? 'Order placed' : st === 'PAID' ? 'Razorpay payment captured' : st === 'COD_PENDING' ? 'Awaiting cash on delivery' : st === 'DELIVERED' ? 'Delivered & signed' : pick(['Routed to fulfillment', 'Picked & packed', 'Manifested with courier', 'Invoiced']), changedBy: step === 0 ? 'customer' : step <= 4 ? admin.id : 'system', at: t });
    }
    if (o.status === 'CANCELLED') {
      t = addHours(t, randInt(2, 12));
      hh.push({ status: 'CANCELLED', comment: pick(CANCEL_REASONS), changedBy: admin.id, at: t });
    }
    historyMap.set(o, hh);
  }

  // ---- 3. persist orders (batched createManyAndReturn) ---------------
  const orderRows: { id: string; orderNumber: string }[] = [];
  for (let i = 0; i < blueprints.length; i += 40) {
    const rets = await prisma.order.createManyAndReturn({
      data: blueprints.slice(i, i + 40).map((o) => ({
        orderNumber: o.orderNumber, userId: o.userId, status: o.status, paymentMethod: o.paymentMethod,
        isB2B: o.isB2B, gstin: o.gstin, companyName: o.companyName,
        subtotal: o.subtotal, discountAmount: o.discountAmount, bundleDiscount: o.bundleDiscount, bundleName: o.bundleName,
        couponCode: o.couponCode, shippingAmount: o.shippingAmount, codFee: o.codFee,
        gstAmount: o.gstAmount, cgstAmount: o.cgstAmount, sgstAmount: o.sgstAmount, igstAmount: o.igstAmount, totalAmount: o.totalAmount,
        deliveryName: o.deliveryName, deliveryPhone: o.deliveryPhone, deliveryLine1: o.deliveryLine1, deliveryLine2: o.deliveryLine2,
        deliveryCity: o.deliveryCity, deliveryState: o.deliveryState, deliveryPincode: o.deliveryPincode,
        customerNote: o.customerNote, estimatedDeliveryAt: o.estimatedDeliveryAt, createdAt: o.createdAt, updatedAt: o.createdAt,
      })),
    });
    orderRows.push(...rets.map((r) => ({ id: r.id, orderNumber: r.orderNumber })));
  }
  const orderIdByNumber = new Map(orderRows.map((r) => [r.orderNumber, r.id]));
  console.log('🧾 Orders:', orderRows.length);

  // ---- 4. order items + status history -------------------------------
  const orderItemData = blueprints.flatMap((o) => {
    const orderId = orderIdByNumber.get(o.orderNumber)!;
    return o.items.map((it) => ({
      orderId, skuId: it.skuId, productName: it.productName, variantName: it.variantName, skuCode: it.skuCode, hsnCode: it.hsnCode,
      quantity: it.quantity, unitPrice: it.unitPrice, taxRate: it.taxRate, taxAmount: it.taxAmount, totalPrice: it.totalPrice,
      serialNumbers: it.serial ? JSON.stringify([`SN${randInt(100000000000, 999999999999)}`]) : null, isCodAllowed: true,
    }));
  });
  for (let i = 0; i < orderItemData.length; i += 80) await prisma.orderItem.createMany({ data: orderItemData.slice(i, i + 80) });
  const historyData = blueprints.flatMap((o) => historyMap.get(o)!.map((h) => ({ orderId: orderIdByNumber.get(o.orderNumber)!, status: h.status, comment: h.comment, changedBy: h.changedBy, createdAt: h.at })));
  for (let i = 0; i < historyData.length; i += 100) await prisma.orderStatusHistory.createMany({ data: historyData.slice(i, i + 100) });
  console.log('📋 Order items:', orderItemData.length, '· history rows:', historyData.length);

  // ---- 5. payments + payment events ----------------------------------
  const paymentRows: { id: string; orderId: string }[] = [];
  for (let i = 0; i < blueprints.length; i += 60) {
    const rets = await prisma.payment.createManyAndReturn({
      data: blueprints.slice(i, i + 60).map((o, k) => ({
        orderId: orderIdByNumber.get(o.orderNumber)!,
        gateway: o.paymentMethod === 'COD' ? 'COD' : 'RAZORPAY',
        gatewayOrderId: `order_SEED${String(i + k).padStart(4, '0')}`,
        gatewayPaymentId: ['SUCCESS', 'REFUNDED'].includes(o.paymentStatus) ? `pay_SEED${String(i + k).padStart(4, '0')}` : null,
        amount: o.totalAmount, currency: 'INR', method: o.paymentMethod === 'COD' ? 'COD' : 'ONLINE',
        status: o.paymentStatus, createdAt: addHours(o.createdAt, 0.05), updatedAt: addHours(o.createdAt, 0.3),
      })),
    });
    paymentRows.push(...rets.map((r) => ({ id: r.id, orderId: r.orderId })));
  }
  const payIdByOrder = new Map(paymentRows.map((p) => [p.orderId, p.id]));
  const peData = blueprints.flatMap((o, idx) => {
    const paymentId = payIdByOrder.get(orderIdByNumber.get(o.orderNumber)!)!;
    return o.paymentEvents.map((eventType, k) => ({
      paymentId, eventId: `evt_seed_pe_${idx}_${k}`, eventType,
      payload: JSON.stringify({ orderNumber: o.orderNumber, amount: o.totalAmount, gateway: o.paymentMethod === 'COD' ? 'COD' : 'razorpay', seed: true }),
      createdAt: addHours(o.createdAt, 0.1 + k * 0.2),
    }));
  });
  for (let i = 0; i < peData.length; i += 100) await prisma.paymentEvent.createMany({ data: peData.slice(i, i + 100) });
  console.log('💳 Payments:', paymentRows.length, '· payment events:', peData.length);

  // ---- 6. shipments + tracking events --------------------------------
  const shipped = blueprints.filter((o) => o.shipment);
  const shipmentRows: { id: string; orderId: string; status: string; awb: string }[] = [];
  for (let i = 0; i < shipped.length; i += 60) {
    const rets = await prisma.shipment.createManyAndReturn({
      data: shipped.slice(i, i + 60).map((o) => ({
        orderId: orderIdByNumber.get(o.orderNumber)!, provider: 'SHIPROCKET', courierName: o.shipment!.courier,
        providerShipmentId: `SHRSEED${String(100000 + i + shipped.indexOf(o)).padStart(7, '0')}`,
        awb: o.shipment!.awb, trackingUrl: `https://shiprocket.co/tracking/${o.shipment!.awb}`,
        status: o.shipment!.status, estimatedDeliveryAt: o.estimatedDeliveryAt,
        dispatchedAt: o.shipment!.dispatchedAt, deliveredAt: o.shipment!.deliveredAt,
        createdAt: o.shipment!.dispatchedAt, updatedAt: o.shipment!.deliveredAt ?? o.shipment!.dispatchedAt,
      })),
    });
    shipmentRows.push(...rets.map((r) => ({ id: r.id, orderId: r.orderId, status: r.status, awb: r.awb! })));
  }
  const seData = shipped.flatMap((o, idx) => {
    const sh = shipmentRows.find((r) => r.awb === o.shipment!.awb)!;
    const chain: [string, string, number][] = [['MANIFESTED', 'Surat, Gujarat', 0], ['PICKED_UP', 'Surat, Gujarat', 6], ['IN_TRANSIT', pick(TRANSIT_HUBS), 24]];
    if (['OUT_FOR_DELIVERY', 'DELIVERED'].includes(sh.status)) chain.push(['OUT_FOR_DELIVERY', `${o.deliveryCity}, ${o.deliveryState}`, 48]);
    if (sh.status === 'DELIVERED') chain.push(['DELIVERED', `${o.deliveryCity}, ${o.deliveryState}`, 66]);
    return chain.map(([st, loc, h], k) => ({
      shipmentId: sh.id, eventId: `evt_seed_se_${idx}_${k}`, status: st, location: loc,
      occurredAt: addHours(o.shipment!.dispatchedAt, h),
      payload: JSON.stringify({ awb: sh.awb, seed: true }), createdAt: addHours(o.shipment!.dispatchedAt, h),
    }));
  });
  for (let i = 0; i < seData.length; i += 100) await prisma.shipmentEvent.createMany({ data: seData.slice(i, i + 100) });
  console.log('🚚 Shipments:', shipmentRows.length, '· tracking events:', seData.length);

  // ---- 7. returns + coupon redemptions -------------------------------
  const returned = blueprints.filter((o) => o.returnInfo);
  const returnRets = await prisma.orderReturn.createManyAndReturn({
    data: returned.map((o) => ({
      orderId: orderIdByNumber.get(o.orderNumber)!, reason: o.returnInfo!.reason, status: o.returnInfo!.status,
      isRma: o.returnInfo!.isRma, refundAmount: o.returnInfo!.refundAmount,
      inwardCourier: o.returnInfo!.inward ? pick(COURIERS) : null,
      inwardTracking: o.returnInfo!.inward ? `RT${randInt(100000000, 999999999)}` : null,
      inwardNote: o.returnInfo!.inward ? pick(['Carton opened — unit powers on, scratches on housing', 'Seal intact, DOA confirmed on bench', 'Customer-packed, accessories complete']) : null,
      inwardAt: o.returnInfo!.inward ? addDays(o.createdAt, 14) : null,
      createdAt: addDays(o.createdAt, 9), updatedAt: addDays(o.createdAt, 15),
    })),
  });
  const redemptionData = blueprints.filter((o) => o.couponId).map((o) => ({
    couponId: o.couponId!, orderId: orderIdByNumber.get(o.orderNumber)!, discountAmount: o.couponDiscount, createdAt: o.createdAt,
  }));
  await prisma.couponRedemption.createMany({ data: redemptionData });
  for (const c of couponRows) {
    await prisma.coupon.update({ where: { id: c.id }, data: { usedCount: redemptionData.filter((r) => r.couponId === c.id).length } });
  }
  console.log('↩️ Returns:', returnRets.length, '· coupon redemptions:', redemptionData.length);

  // ---- 8. reviews ------------------------------------------------------
  const reviewSeen = new Set<string>();
  const reviewData: { productId: string; userId: string; rating: number; title: string; comment: string; isApproved: boolean; isVerified: boolean; createdAt: Date }[] = [];
  for (const p of productMetaList) {
    const n = randInt(3, 6);
    let made = 0;
    let guard = 0;
    while (made < n && guard++ < 24) {
      const u = pick(custUsers);
      const key = `${p.id}:${u.id}`;
      if (reviewSeen.has(key)) continue;
      reviewSeen.add(key);
      const [rating, title, comment] = pick(REVIEW_POOL);
      reviewData.push({ productId: p.id, userId: u.id, rating, title, comment, isApproved: rnd() < 0.92, isVerified: rnd() < 0.8, createdAt: daysAgo(2, 130) });
      made++;
    }
  }
  for (let i = 0; i < reviewData.length; i += 60) await prisma.review.createMany({ data: reviewData.slice(i, i + 60) });
  console.log('⭐ Reviews:', reviewData.length);

  // ---- 9. carts, wishlists, stock alerts ------------------------------
  const carts = await prisma.cart.createManyAndReturn({
    data: [...custUsers.slice(0, 10).map((u) => ({ userId: u.id })), ...[1, 2, 3].map((n) => ({ guestToken: `guest_seed_${n}` }))],
  });
  const cartItemData = carts.flatMap((c) => {
    const used = new Set<string>();
    const rows: { cartId: string; skuId: string; quantity: number; createdAt: Date }[] = [];
    for (let i = 0, n = randInt(1, 3); i < n; i++) {
      const s = pick(salableSkus);
      if (used.has(s.code)) continue;
      used.add(s.code);
      rows.push({ cartId: c.id, skuId: s.id, quantity: randInt(1, 3), createdAt: daysAgo(0, 6) });
    }
    return rows;
  });
  await prisma.cartItem.createMany({ data: cartItemData });
  const wishlists = await prisma.wishlist.createManyAndReturn({ data: custUsers.slice(10, 24).map((u) => ({ userId: u.id })) });
  const wliData = wishlists.flatMap((w) => {
    const used = new Set<string>();
    const rows: { wishlistId: string; productId: string; priceAtAddPaise: number; createdAt: Date }[] = [];
    for (let i = 0, n = randInt(1, 4); i < n; i++) {
      const p = pick(productMetaList);
      if (used.has(p.id)) continue;
      used.add(p.id);
      rows.push({ wishlistId: w.id, productId: p.id, priceAtAddPaise: p.minPrice, createdAt: daysAgo(1, 60) });
    }
    return rows;
  });
  await prisma.wishlistItem.createMany({ data: wliData });
  const oosSkus = skuRows.filter((s) => (s.inventory?.currentStock ?? 1) <= 4);
  const alertSeen = new Set<string>();
  const alertData: { skuId: string; phone: string; status: string; notifiedAt: Date | null; createdAt: Date }[] = [];
  for (const s of oosSkus) {
    for (let k = 0; k < 3; k++) {
      const u = pick(custUsers);
      const key = `${s.id}:${u.phone}`;
      if (alertSeen.has(key)) continue;
      alertSeen.add(key);
      alertData.push({ skuId: s.id, phone: u.phone, status: 'PENDING', notifiedAt: null, createdAt: daysAgo(1, 25) });
    }
  }
  await prisma.stockAlert.createMany({ data: alertData });
  console.log('🛒 Carts:', carts.length, '· cart items:', cartItemData.length, '· wishlists:', wishlists.length, '· wishlist items:', wliData.length, '· stock alerts:', alertData.length);

  // ---- 10. B2B inquiries + OTP trail ----------------------------------
  await prisma.b2BInquiry.createMany({
    data: Array.from({ length: 14 }, (_, i) => {
      const status = i < 5 ? 'NEW' : i < 10 ? 'CONTACTED' : 'CLOSED';
      const createdAt = daysAgo(1, 90);
      const handledAt = status === 'NEW' ? null : addHours(createdAt, randInt(4, 40));
      return {
        name: `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`, phone: `+91${9812345000 + i * 211}`,
        email: i % 3 === 0 ? `buyer${i}@example.in` : null, companyName: i % 2 === 0 ? pick(COMPANIES) : null,
        gstin: i % 2 === 0 ? genGstin(200 + i) : null, message: pick(B2B_MESSAGES),
        productId: i % 3 === 0 ? pick(productMetaList).id : null, status,
        note: status === 'NEW' ? null : pick(['Quoted dealer price — awaiting PO', 'Sample unit handed over at counter', 'Closed — went with local vendor', 'Follow up next month for AMC']),
        handledAt, createdAt, updatedAt: handledAt ?? createdAt,
      };
    }),
  });
  await prisma.otpVerification.createMany({
    data: Array.from({ length: 12 }, (_, i) => {
      const createdAt = daysAgo(0, 45);
      const verified = i % 3 !== 2;
      return { phone: i < 8 ? pick(custUsers).phone : `+9198111${String(10000 + i).slice(-5)}`, codeHash: `seedotp_${i}_hash`, expiresAt: addHours(createdAt, 0.167), isVerified: verified, attempts: verified ? 1 : randInt(0, 3), createdAt };
    }),
  });
  console.log('🤝 B2B inquiries: 14 · OTP trail: 12');

  // ---- 11. stock-monitor lifecycle (ADR-010) --------------------------
  const hdInv = await prisma.inventory.findMany({
    where: { sku: { variant: { product: { categoryId: subHd.id } } } },
    include: { sku: { select: { code: true } } },
  });
  const sessClosedAt = daysAgo(20, 26);
  const sessClosed = await prisma.stockCountSession.create({
    data: {
      title: 'Q2 FY26 shelf audit — HD analog cameras', status: 'CLOSED', scopeKind: 'CATEGORY', scopeRefId: subHd.id,
      expected: JSON.stringify(hdInv.slice(0, 8).map((x) => ({ skuId: x.skuId, code: x.sku.code, expectedQty: x.currentStock }))),
      openedById: staffWarehouse.id, closedById: admin.id, closedAt: addDays(sessClosedAt, 2), createdAt: sessClosedAt,
    },
  });
  const closedLineRets = await prisma.stockCountLine.createManyAndReturn({
    data: hdInv.slice(0, 8).map((x) => {
      const drift = rnd() < 0.35 ? randInt(-3, 2) : 0;
      return {
        sessionId: sessClosed.id, skuId: x.skuId, expectedQty: x.currentStock, countedQty: x.currentStock + drift, variance: drift,
        countedById: staffCounter.id, countedAt: addHours(sessClosedAt, 20),
        note: drift !== 0 ? pick(['Two units at repair bench', 'Found sealed units in showcase', 'Mis-shelved under bullet rack', 'Demo unit on shopfloor']) : null,
        appliedAt: addDays(sessClosedAt, 2),
      };
    }),
  });
  for (const line of closedLineRets.filter((l) => (l.variance ?? 0) !== 0)) {
    const mv = await prisma.inventoryMovement.create({
      data: { skuId: line.skuId, quantity: line.variance!, reason: line.variance! < 0 ? 'DAMAGED_WRITE_OFF' : 'RETURN_RESTOCK', referenceId: line.id, notes: `Applied from count session ${sessClosed.title}`, createdById: admin.id },
    });
    await prisma.stockCountLine.update({ where: { id: line.id }, data: { appliedMovementId: mv.id } });
  }
  const hikInv = await prisma.inventory.findMany({
    where: { sku: { variant: { product: { brandId: brands['hikvision'] } } }, currentStock: { gt: 0 } },
    include: { sku: { select: { code: true } } },
  });
  const sessCountingAt = daysAgo(2, 4);
  const sessCounting = await prisma.stockCountSession.create({
    data: {
      title: 'Weekly spot check — Hikvision shelves', status: 'COUNTING', scopeKind: 'BRAND', scopeRefId: brands['hikvision'],
      expected: JSON.stringify(hikInv.slice(0, 6).map((x) => ({ skuId: x.skuId, code: x.sku.code, expectedQty: x.currentStock }))),
      openedById: staffWarehouse.id, createdAt: sessCountingAt,
    },
  });
  await prisma.stockCountLine.createMany({
    data: hikInv.slice(0, 6).map((x, i) => {
      const counted = i < 4 ? x.currentStock + (rnd() < 0.3 ? randInt(-1, 1) : 0) : null;
      return {
        sessionId: sessCounting.id, skuId: x.skuId, expectedQty: x.currentStock, countedQty: counted,
        variance: counted === null ? null : counted - x.currentStock,
        countedById: counted === null ? null : staffCounter.id, countedAt: counted === null ? null : addHours(sessCountingAt, 5 + i * 2),
      };
    }),
  });
  const sessOpenAt = daysAgo(0, 1);
  const sessOpen = await prisma.stockCountSession.create({
    data: {
      title: 'Month-end full floor count', status: 'OPEN', scopeKind: 'ALL',
      expected: JSON.stringify(salableSkus.slice(0, 10).map((s) => ({ skuId: s.id, code: s.code, expectedQty: s.inventory?.currentStock ?? 0 }))),
      openedById: staffCounter.id, createdAt: sessOpenAt,
    },
  });
  await prisma.stockCountLine.createMany({
    data: salableSkus.slice(0, 10).map((s) => ({ sessionId: sessOpen.id, skuId: s.id, expectedQty: s.inventory?.currentStock ?? 0 })),
  });

  // adjustment requests: PENDING → APPROVED (with real movements) → REJECTED
  const ADJ_SPECS: { code: string; delta: number; reason: string; note: string; status: string }[] = [
    { code: 'CPP-D01-2MP-36', delta: -2, reason: 'DAMAGED', note: 'Two domes cracked in transit from Ahmedabad branch', status: 'PENDING' },
    { code: 'CPP-CBL-90M', delta: -1, reason: 'MISSING', note: 'Box missing from rack B4 after festival rush', status: 'PENDING' },
    { code: 'AXP-BNCD-10', delta: 4, reason: 'FOUND', note: 'Unopened packs recovered from old showcase', status: 'PENDING' },
    { code: 'HIK-IP-4MP-4MM', delta: 0, reason: 'WRONG_LOCATION', note: 'Moved to IP rack — count unchanged', status: 'PENDING' },
    { code: 'WDP-HDD-2TB', delta: -1, reason: 'DAMAGED', note: 'Failed SMART check on bench', status: 'APPROVED' },
    { code: 'DL-C6-90M', delta: 2, reason: 'FOUND', note: 'Return-to-stock from cancelled order restock', status: 'APPROVED' },
    { code: 'LAP-MON-22HD', delta: -1, reason: 'OTHER', note: 'Display unit converted to counter demo', status: 'APPROVED' },
    { code: 'OPL-CONV-SM20', delta: 1, reason: 'FOUND', note: 'Extra unit found on RMA shelf', status: 'APPROVED' },
    { code: 'CPP-DVR-8CH', delta: -1, reason: 'MISSING', note: 'Serial gap during dispatch staging', status: 'REJECTED' },
    { code: 'MTC-RJ45-K20', delta: -2, reason: 'MISSING', note: 'Reported missing — recount found them', status: 'REJECTED' },
  ];
  for (const spec of ADJ_SPECS) {
    const skuId = skuToId[spec.code];
    if (!skuId) continue;
    const req = await prisma.stockAdjustmentRequest.create({
      data: {
        skuId, delta: spec.delta, reason: spec.reason, note: spec.note, status: spec.status,
        requestedById: staffCounter.id, createdAt: daysAgo(1, 30),
        decidedById: spec.status === 'PENDING' ? null : admin.id,
        decidedAt: spec.status === 'PENDING' ? null : addHours(daysAgo(1, 30), 30),
      },
    });
    if (spec.status === 'APPROVED' && spec.delta !== 0) {
      const mv = await prisma.inventoryMovement.create({
        data: { skuId, quantity: spec.delta, reason: 'MANUAL_ADJUSTMENT', referenceId: req.id, notes: `Approved adjustment: ${spec.reason}`, createdById: admin.id },
      });
      await prisma.stockAdjustmentRequest.update({ where: { id: req.id }, data: { movementId: mv.id } });
    }
  }
  // extra historical movements for the ledger
  const extraMovements = Array.from({ length: 15 }, () => {
    const s = pick(skuRows);
    const kind = rnd();
    if (kind < 0.4) return { skuId: s.id, quantity: randInt(10, 30), reason: 'PURCHASE_RECEIPT', referenceId: `PO-2026-${randInt(100, 999)}`, notes: 'Stock lot received from distributor', createdById: staffWarehouse.id, createdAt: daysAgo(5, 150) };
    if (kind < 0.75) return { skuId: s.id, quantity: 1, reason: 'RETURN_RESTOCK', referenceId: pick(orderRows).orderNumber, notes: 'Customer return restocked after QC', createdById: staffWarehouse.id, createdAt: daysAgo(2, 90) };
    return { skuId: s.id, quantity: -randInt(1, 2), reason: 'DAMAGED_WRITE_OFF', referenceId: null, notes: pick(['Water damage in storage', 'Failed QC on bench', 'Cracked housing — written off']), createdById: staffWarehouse.id, createdAt: daysAgo(2, 90) };
  });
  await prisma.inventoryMovement.createMany({ data: extraMovements });
  console.log('📦 Stock monitor: 3 sessions, 10 adjustment requests,', extraMovements.length, 'ledger movements');

  // ---- 12. audit trail -------------------------------------------------
  const staffIds = [admin.id, staffWarehouse.id, staffFulfillment.id, staffContent.id];
  const returnIds = returnRets.map((r) => r.id);
  const auditData = Array.from({ length: 80 }, () => {
    const [action, entity, blurb] = pick(AUDIT_ACTIONS);
    let entityId: string | null = null;
    if (entity === 'Order') entityId = pick(orderRows).id;
    else if (entity === 'Product') entityId = pick(productMetaList).id;
    else if (entity === 'Coupon') entityId = pick(couponRows).id;
    else if (entity === 'OrderReturn' && returnIds.length) entityId = pick(returnIds);
    else if (entity === 'Setting') entityId = 'announcement';
    else if (entity === 'Session') entityId = null;
    else if (entity === 'Inventory') entityId = pick(skuRows).id;
    return {
      userId: pick(staffIds), action, entity, entityId,
      details: JSON.stringify({ note: blurb, seed: true }),
      ip: `103.${randInt(1, 254)}.${randInt(1, 254)}.${randInt(1, 254)}`,
      createdAt: daysAgo(0, 170),
    };
  });
  for (let i = 0; i < auditData.length; i += 40) await prisma.auditLog.createMany({ data: auditData.slice(i, i + 40) });
  console.log('🧾 Audit logs:', auditData.length);


  const { saveSettings } = await import('../src/server/services/settings.service');
  await saveSettings({
    announcement: 'Same-day dispatch on orders confirmed before 4:00 PM IST (Mon–Sat) · Pan-India delivery',
  });

  // ---- 13. per-table verification --------------------------------------
  const tableReport: [string, { count: () => Promise<number> }][] = [
    ['users', prisma.user], ['otp_verifications', prisma.otpVerification], ['customers', prisma.customer],
    ['addresses', prisma.address], ['categories', prisma.category], ['brands', prisma.brand],
    ['products', prisma.product], ['product_images', prisma.productImage], ['product_variants', prisma.productVariant],
    ['skus', prisma.sku], ['inventory', prisma.inventory], ['inventory_movements', prisma.inventoryMovement],
    ['stock_count_sessions', prisma.stockCountSession], ['stock_count_lines', prisma.stockCountLine],
    ['stock_adjustment_requests', prisma.stockAdjustmentRequest], ['bundles', prisma.bundle], ['bundle_items', prisma.bundleItem],
    ['carts', prisma.cart], ['cart_items', prisma.cartItem], ['wishlists', prisma.wishlist], ['wishlist_items', prisma.wishlistItem],
    ['orders', prisma.order], ['order_items', prisma.orderItem], ['order_status_history', prisma.orderStatusHistory],
    ['payments', prisma.payment], ['payment_events', prisma.paymentEvent], ['shipments', prisma.shipment],
    ['shipment_events', prisma.shipmentEvent], ['order_returns', prisma.orderReturn], ['coupons', prisma.coupon],
    ['coupon_redemptions', prisma.couponRedemption], ['banners', prisma.banner], ['posts', prisma.post],
    ['reviews', prisma.review], ['b2b_inquiries', prisma.b2BInquiry], ['stock_alerts', prisma.stockAlert],
    ['audit_logs', prisma.auditLog], ['settings', prisma.setting],
  ];
  const counts: string[] = [];
  for (const [name, model] of tableReport) counts.push(`${name}=${await model.count()}`);
  console.log('📊 Per-table row counts:\n   ' + counts.join('\n   '));

  console.log('✅ Seed complete');
  console.log(`   Admin login: ${admin.email} / ${adminPass}`);
  console.log('   Customer login: +919876543210 (OTP shown in console in sandbox mode)');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
