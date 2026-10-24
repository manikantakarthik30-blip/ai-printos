// Print product specifications (physical sizes). This is a spec catalog, not a store:
// no prices, stock or ordering are shown because this build has no backend for them.
import { mmToPx } from '../core/util.js';

export const CATALOG = [
  { id: 'bcard', name: 'Business card', group: 'cards', mm: [90, 54], use: 'Contact details for networking and shops.' },
  { id: 'bcard-us', name: 'Business card (3.5 × 2 in)', group: 'cards', mm: [89, 51], use: 'North American standard card size.' },
  { id: 'postcard', name: 'Postcard A6', group: 'cards', mm: [105, 148], use: 'Greetings, thank-you notes and mailers.' },
  { id: 'invite', name: 'Invitation 5 × 7 in', group: 'cards', mm: [127, 178], use: 'Weddings, birthdays and ceremonies.' },
  { id: 'bookmark', name: 'Bookmark', group: 'cards', mm: [50, 150], use: 'Giveaways for shops, schools and libraries.' },
  { id: 'flyer-a5', name: 'Flyer A5', group: 'flyers', mm: [148, 210], use: 'Offers, events and handouts.' },
  { id: 'flyer-a4', name: 'Flyer A4', group: 'flyers', mm: [210, 297], use: 'Notices, menus and price lists.' },
  { id: 'dl', name: 'DL leaflet', group: 'flyers', mm: [99, 210], use: 'Slim leaflets that fit a standard envelope.' },
  { id: 'brochure', name: 'Bi-fold brochure spread (A4 landscape)', group: 'flyers', mm: [297, 210], use: 'Catalogues and company profiles; fold in half.' },
  { id: 'poster-a3', name: 'Poster A3', group: 'posters', mm: [297, 420], use: 'Shop windows and notice boards.' },
  { id: 'poster-a2', name: 'Poster A2', group: 'posters', mm: [420, 594], use: 'Events and large announcements.' },
  { id: 'banner', name: 'Banner 1200 × 600 mm', group: 'posters', mm: [1200, 600], use: 'Shopfront and event banners (2:1).' },
  { id: 'letterhead', name: 'Letterhead A4', group: 'stationery', mm: [210, 297], use: 'Official letters and invoices.' },
  { id: 'certificate', name: 'Certificate A4 landscape', group: 'stationery', mm: [297, 210], use: 'Awards, courses and recognition.' },
  { id: 'sticker', name: 'Square sticker / label', group: 'stationery', mm: [76, 76], use: 'Product labels and packaging seals.' }
].map((p) => ({ ...p, w: mmToPx(p.mm[0]), h: mmToPx(p.mm[1]) }));
export const CATALOG_GROUPS = ['cards', 'flyers', 'posters', 'stationery'];
