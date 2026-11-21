require('dotenv').config();
const mongoose = require('mongoose');
const Location = require('../models/studyLocationModel');

const ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

const QUERY = `
[out:json][timeout:180];
area(3601903516)->.hanoi;
(
  nwr["amenity"~"^(library|university|college|cafe)$"](area.hanoi);
  nwr["office"="coworking"](area.hanoi);
  nwr["amenity"="coworking_space"](area.hanoi);
);
out center tags;
`;

function valueIsTrue(value) {
  return ['yes', 'true', 'free', 'wlan', 'wifi'].includes(String(value || '').toLowerCase());
}

function typeFor(tags) {
  if (tags.amenity === 'library') return 'library';
  if (tags.amenity === 'cafe') return 'cafe';
  if (tags.office === 'coworking' || tags.amenity === 'coworking_space') return 'group-space';
  return 'self-study';
}

function buildAddress(tags) {
  const street = [tags['addr:housenumber'], tags['addr:street']].filter(Boolean).join(' ');
  const parts = [
    street,
    tags['addr:suburb'] || tags['addr:quarter'] || tags['addr:ward'],
    tags['addr:district'],
    tags['addr:city'] || 'Hà Nội',
  ].filter(Boolean);
  return [...new Set(parts)].join(', ') || 'Hà Nội · dữ liệu OpenStreetMap';
}

function toLocation(element) {
  const tags = element.tags || {};
  const name = tags['name:vi'] || tags.name || tags.brand;
  const latitude = element.lat ?? element.center?.lat;
  const longitude = element.lon ?? element.center?.lon;
  if (!name || !Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

  const type = typeFor(tags);
  const wifi = valueIsTrue(tags.internet_access) || valueIsTrue(tags.wifi);
  const powerOutlets =
    valueIsTrue(tags.power_supply) ||
    Object.entries(tags).some(([key, value]) => key.startsWith('socket:') && valueIsTrue(value));
  const elementPath =
    element.type === 'node' ? 'node' : element.type === 'way' ? 'way' : 'relation';

  return {
    name: String(name).slice(0, 120),
    address: buildAddress(tags).slice(0, 250),
    coordinates: { type: 'Point', coordinates: [longitude, latitude] },
    description:
      'Địa điểm được tổng hợp từ OpenStreetMap. Hãy kiểm tra giờ mở cửa, quyền ra vào và tiện ích trước khi đến.',
    type,
    quietLevel: type === 'library' ? 5 : type === 'self-study' ? 4 : 3,
    wifi,
    powerOutlets,
    suitableFor: type === 'library' ? ['individual'] : ['individual', 'group'],
    externalSource: 'openstreetmap',
    externalId: `${element.type}/${element.id}`,
    sourceUrl: `https://www.openstreetmap.org/${elementPath}/${element.id}`,
    sourceUpdatedAt: new Date(),
    isSample: false,
    verified: false,
    active: true,
  };
}

async function download() {
  let lastError;
  for (const endpoint of ENDPOINTS) {
    try {
      console.log(`Requesting OpenStreetMap data from ${endpoint} ...`);
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'content-type': 'application/x-www-form-urlencoded;charset=UTF-8',
          'user-agent': 'PTITSocial-StudySpot/1.0',
        },
        body: new URLSearchParams({ data: QUERY }),
        signal: AbortSignal.timeout(240000),
      });
      if (!response.ok) throw new Error(`Overpass returned HTTP ${response.status}`);
      return response.json();
    } catch (error) {
      lastError = error;
      console.warn(`${endpoint} failed: ${error.message}`);
    }
  }
  throw lastError;
}

async function run() {
  const payload = await download();
  const unique = new Map();
  for (const element of payload.elements || []) {
    const location = toLocation(element);
    if (location) unique.set(location.externalId, location);
  }
  if (!unique.size) throw new Error('OpenStreetMap returned no named study locations for Hà Nội.');

  await mongoose.connect(process.env.DATABASE);
  const operations = [...unique.values()].map((location) => ({
    updateOne: {
      filter: { externalSource: 'openstreetmap', externalId: location.externalId },
      update: { $set: location },
      upsert: true,
    },
  }));
  const result = await Location.bulkWrite(operations, { ordered: false });
  console.log(
    `Imported ${unique.size} named Hà Nội locations (${result.upsertedCount} new, ${result.modifiedCount} updated).`
  );
  await mongoose.disconnect();
}

run().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
