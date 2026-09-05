export const ORG_NAME = 'Moktari (مُكتري)';
export const ORG_DESCRIPTION =
  'مُكتري هو سوق الإيجارات في اليمن. ابحث عن شقق، غرف، ومنازل للإيجار بسهولة.';

type JsonLdObject = Record<string, unknown>;

export interface ListingJsonLdInput {
  id: string;
  title: string;
  description?: string | null;
  price: number;
  currency?: string | null;
  governorate?: string | null;
  city_name?: string | null;
  neighborhood?: string | null;
  published_at?: string | null;
  listing_images?: { url: string; is_primary: boolean | null }[] | null;
}

const dropEmpty = <T extends Record<string, unknown>>(obj: T): T =>
  Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined && v !== null && v !== '')
  ) as T;

export const buildOrganizationJsonLd = (origin: string): JsonLdObject =>
  dropEmpty({
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: ORG_NAME,
    url: `${origin}/`,
    logo: `${origin}/favicon.png`,
    description: ORG_DESCRIPTION,
  });

export const buildBreadcrumbJsonLd = (
  origin: string,
  listing: { id: string; title: string }
): JsonLdObject => ({
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'الرئيسية', item: `${origin}/` },
    { '@type': 'ListItem', position: 2, name: 'الإعلانات', item: `${origin}/listings` },
    { '@type': 'ListItem', position: 3, name: listing.title, item: `${origin}/listings/${listing.id}` },
  ],
});

export const getListingPrimaryImage = (
  listing: ListingJsonLdInput
): string | null => {
  const imgs = listing.listing_images;
  if (!imgs || imgs.length === 0) return null;
  return imgs.find((i) => i.is_primary)?.url || imgs[0].url || null;
};

export const buildListingJsonLd = (
  origin: string,
  listing: ListingJsonLdInput,
  imageUrl?: string | null
): JsonLdObject => {
  const seoLocation = [listing.governorate, listing.city_name, listing.neighborhood]
    .filter(Boolean)
    .join(' — ');
  const fallbackDescription = listing.title
    ? `${listing.title}${seoLocation ? ` — ${seoLocation}` : ''} — بسعر ${Number(listing.price).toLocaleString('en-GB')} ريال`
    : undefined;
  const description = listing.description?.trim() || fallbackDescription;

  const address = dropEmpty({
    '@type': 'PostalAddress',
    addressRegion: listing.governorate,
    addressLocality: listing.city_name || listing.neighborhood,
  });

  const hasAddress =
    Object.keys(address).length > 1 || Boolean(listing.governorate || listing.city_name || listing.neighborhood);

  return dropEmpty({
    '@context': 'https://schema.org',
    '@type': 'RealEstateListing',
    name: listing.title,
    url: `${origin}/listings/${listing.id}`,
    ...(imageUrl ? { image: imageUrl } : {}),
    ...(description ? { description } : {}),
    ...(listing.published_at ? { datePosted: listing.published_at } : {}),
    offers: dropEmpty({
      '@type': 'Offer',
      price: listing.price,
      priceCurrency: listing.currency || 'YER',
    }),
    ...(hasAddress
      ? {
          contentLocation: dropEmpty({
            '@type': 'Place',
            ...(seoLocation ? { name: seoLocation } : {}),
            address,
          }),
        }
      : {}),
  });
};