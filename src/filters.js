// Cosmetic filters: elements to hide. DNS blocking already stops most ad
// requests, so these mainly remove the empty boxes and "Advertisement" frames
// left behind. Hand-picked generic selectors (not copied from EasyList, which
// has its own license). Keep them to plain CSS2/CSS3 selectors: the 2017 TV
// engine (Chrome 47) drops a whole stylesheet rule on one selector it doesn't
// understand, so main code also tests each one before use.
export var GENERIC = [
  'ins.adsbygoogle',
  '.adsbygoogle',
  '[id^="google_ads_iframe"]',
  '[id^="div-gpt-ad"]',
  '[id^="gpt-ad-"]',
  '[data-google-query-id]',
  'iframe[src*="doubleclick.net"]',
  'iframe[src*="googlesyndication.com"]',
  'iframe[src*="amazon-adsystem.com"]',
  'a[href*="doubleclick.net/"]',
  'a[href*="googleadservices.com/"]',
  'amp-ad',
  'amp-embed[type="taboola"]',
  'amp-sticky-ad',
  '[data-ad-slot]',
  '[data-ad-unit]',
  '[data-adunit]',
  '[data-ad-placement]',
  '[aria-label="Advertisement"]',
  '[aria-label="Sponsored"]',
  '.ad-slot',
  '.ad-container',
  '.ad-wrapper',
  '.ad-banner',
  '.ad-unit',
  '.ad-placeholder',
  '.ad-leaderboard',
  '.leaderboard-ad',
  '.sidebar-ad',
  '.sticky-ad',
  '.adBanner',
  '.adContainer',
  '.advertisement',
  '.trc_related_container',
  '[id^="taboola-"]',
  '.OUTBRAIN',
  '.ob-widget',
  '[id^="outbrain_widget"]',
  '[id^="mgid_"]',
  '.zergnet-widget'
];

// Extra selectors for particular sites, keyed by domain (subdomains match).
// Example: 'example.com': ['.promo-rail', '#sponsor-strip']
export var SITE = {};
