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

async function main() {
  console.log('🌱 Seeding Patel Networks catalog…');

  // Clean in dependency order
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
  const adminPass = process.env.ADMIN_PASSWORD ?? 'patel@admin2026';
  const admin = await prisma.user.create({
    data: {
      phone: '+919899000001',
      email: (process.env.ADMIN_EMAIL ?? 'superadmin@patelnetworks.in').toLowerCase(),
      fullName: 'Platform Superadmin',
      role: 'SUPER_ADMIN',
      passwordHash: hashPassword(adminPass),
    },
  });
  // staff accounts (RBAC demo)
  await prisma.user.create({
    data: {
      phone: '+919899000002',
      email: 'inventory@patelnetworks.in',
      fullName: 'Warehouse Manager',
      role: 'INVENTORY_MANAGER',
      passwordHash: hashPassword('warehouse@2026'),
    },
  });
  await prisma.user.create({
    data: {
      phone: '+919899000003',
      email: 'orders@patelnetworks.in',
      fullName: 'Fulfillment Desk',
      role: 'ORDER_MANAGER',
      passwordHash: hashPassword('fulfill@2026'),
    },
  });
  // counter staff — Stock Monitor persona (ADR-010): observe & report only
  await prisma.user.create({
    data: {
      phone: '+919899000004',
      email: 'staff@patelnetworks.in',
      fullName: 'Counter Staff',
      role: 'STAFF',
      passwordHash: hashPassword('counter@2026'),
    },
  });
  console.log('👤 Admin:', admin.email);
  console.log('👤 Staff (stock monitor): staff@patelnetworks.in / counter@2026');

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

  // ---------------- settings ----------------
  const { saveSettings } = await import('../src/server/services/settings.service');
  await saveSettings({
    announcement: 'Same-day dispatch on orders confirmed before 4:00 PM IST (Mon–Sat) · Pan-India delivery',
  });

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
