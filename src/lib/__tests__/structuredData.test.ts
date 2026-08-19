import { describe, it, expect } from 'vitest';
import {
  buildOrganizationJsonLd,
  buildBreadcrumbJsonLd,
  buildListingJsonLd,
  getListingPrimaryImage,
  ORG_NAME,
  ORG_DESCRIPTION,
} from '@/lib/structuredData';

const ORIGIN = 'https://moktari.test';

describe('structuredData', () => {
  it('Organization uses only real fields', () => {
    const org = buildOrganizationJsonLd(ORIGIN);
    expect(org['@context']).toBe('https://schema.org');
    expect(org['@type']).toBe('Organization');
    expect(org.name).toBe(ORG_NAME);
    expect(org.description).toBe(ORG_DESCRIPTION);
    expect(org.url).toBe(`${ORIGIN}/`);
    expect(org.logo).toBe(`${ORIGIN}/favicon.png`);
  });

  it('BreadcrumbList reflects visible hierarchy', () => {
    const bc = buildBreadcrumbJsonLd(ORIGIN, { id: 'abc', title: 'شقة للايجار' });
    expect(bc['@type']).toBe('BreadcrumbList');
    const items = bc.itemListElement as Array<{ position: number; name: string; item: string }>;
    expect(items).toHaveLength(3);
    expect(items[0].position).toBe(1);
    expect(items[0].item).toBe(`${ORIGIN}/`);
    expect(items[1].item).toBe(`${ORIGIN}/listings`);
    expect(items[2].item).toBe(`${ORIGIN}/listings/abc`);
    expect(items[2].name).toBe('شقة للايجار');
  });

  it('Listing JSON-LD serializes valid JSON and uses real fields only', () => {
    const listing = {
      id: 'abc',
      title: 'شقة للايجار',
      description: 'شقة حديثة',
      price: 25000,
      currency: 'YER',
      governorate: 'تعز',
      city_name: 'الحوبان',
      neighborhood: 'الخمسين',
      published_at: '2026-08-01T00:00:00Z',
      listing_images: [{ url: 'https://cdn.example/1.jpg', is_primary: true }],
    };
    const ld = buildListingJsonLd(ORIGIN, listing, 'https://cdn.example/1.jpg');
    expect(() => JSON.parse(JSON.stringify(ld))).not.toThrow();
    expect(ld['@type']).toBe('RealEstateListing');
    expect(ld.name).toBe('شقة للايجار');
    expect(ld.url).toBe(`${ORIGIN}/listings/abc`);
    expect(ld.image).toBe('https://cdn.example/1.jpg');
    expect(ld.description).toBe('شقة حديثة');
    expect(ld.datePosted).toBe('2026-08-01T00:00:00Z');
    expect((ld.offers as any).price).toBe(25000);
    expect((ld.offers as any).priceCurrency).toBe('YER');
    const serialized = JSON.stringify(ld);
    // No invented fields
    for (const bad of ['aggregateRating', 'review', 'rating', 'latitude', 'longitude', 'availability', 'priceValidUntil', 'streetAddress', 'reviewCount', 'itemCondition']) {
      expect(serialized).not.toContain(bad);
    }
  });

  it('Listing JSON-LD falls back to YER and omits missing optional fields', () => {
    const minimal = {
      id: 'x1',
      title: 'غرفة',
      price: 8000,
      description: null,
      currency: null,
      governorate: null,
      city_name: null,
      neighborhood: null,
      published_at: null,
      listing_images: [],
    };
    const ld = buildListingJsonLd(ORIGIN, minimal, null);
    expect((ld.offers as any).priceCurrency).toBe('YER');
    expect(ld.description).toBeDefined();
    expect(JSON.stringify(ld)).not.toContain('datePosted');
    expect(JSON.stringify(ld)).not.toContain('contentLocation');
    expect(JSON.stringify(ld)).not.toContain('image');
    expect(() => JSON.parse(JSON.stringify(ld))).not.toThrow();
  });

  it('getListingPrimaryImage prefers is_primary then first', () => {
    const primary = getListingPrimaryImage({
      id: 'x',
      title: 't',
      price: 1,
      listing_images: [
        { url: 'https://cdn.example/2.jpg', is_primary: false },
        { url: 'https://cdn.example/3.jpg', is_primary: true },
      ],
    });
    expect(primary).toBe('https://cdn.example/3.jpg');
    expect(getListingPrimaryImage({ id: 'x', title: 't', price: 1, listing_images: [] })).toBeNull();
  });

  it('Listing without reviews/ratings/availability never emits unsupported props', () => {
    const ld = buildListingJsonLd(ORIGIN, {
      id: 'abc',
      title: 'منزل',
      price: 50000,
      listing_images: [],
    });
    expect((ld as any).aggregateRating).toBeUndefined();
    expect((ld as any).review).toBeUndefined();
    expect((ld as any).offers.availability).toBeUndefined();
  });
});