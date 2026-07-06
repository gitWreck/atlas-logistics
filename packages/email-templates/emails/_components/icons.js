function svgDataUri(svg) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg.trim())}`;
}

const ICONS = {
  mobile: svgDataUri(`
<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect x="7" y="2" width="10" height="20" rx="2" stroke="#2563EB" stroke-width="1.75"/>
  <path d="M11 18H13" stroke="#2563EB" stroke-width="1.75" stroke-linecap="round"/>
</svg>`),
  envelopeSm: svgDataUri(`
<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect x="2" y="3.5" width="12" height="9" rx="1.25" stroke="#2563EB" stroke-width="1.25"/>
  <path d="M2 5L8 9L14 5" stroke="#2563EB" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`),
  headset: svgDataUri(`
<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M4 12V11C4 7.13401 7.13401 4 11 4H13C16.866 4 20 7.13401 20 11V12" stroke="#2563EB" stroke-width="1.75" stroke-linecap="round"/>
  <rect x="2" y="12" width="4" height="7" rx="1.5" stroke="#2563EB" stroke-width="1.75"/>
  <rect x="18" y="12" width="4" height="7" rx="1.5" stroke="#2563EB" stroke-width="1.75"/>
  <path d="M8 19H16" stroke="#2563EB" stroke-width="1.75" stroke-linecap="round"/>
</svg>`),
  shield: svgDataUri(`
<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M12 3L20 6.5V11.5C20 16.1944 16.866 19.5 12 21C7.13401 19.5 4 16.1944 4 11.5V6.5L12 3Z" stroke="#2563EB" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`),
  phone: svgDataUri(`
<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M4.5 2.5H6.2L7.2 5.6L5.8 6.4C6.5 8.1 7.9 9.5 9.6 10.2L10.4 8.8L13.5 9.8V11.5C13.5 11.8 13.3 12 13 12C7.2 11.5 4.5 8.8 4 3C4 2.7 4.2 2.5 4.5 2.5Z" stroke="#2563EB" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`),
  envelope: svgDataUri(`
<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect x="3" y="5" width="18" height="14" rx="2" stroke="#2563EB" stroke-width="1.75"/>
  <path d="M3 7L12 13L21 7" stroke="#2563EB" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`),
};

module.exports = { ICONS };
