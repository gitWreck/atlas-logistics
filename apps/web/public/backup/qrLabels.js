// Requires: https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js loaded in page
// Usage: await AtlasQR.printSingleLabel({trackingNumber, origin, destination, customerName, totalItems})

window.AtlasQR = {
  buildQrValue(trackingNumber) {
    // Recommended: public URL QR
    const t = encodeURIComponent(String(trackingNumber || "").trim());
    return `https://atlas-tracking.web.app/?t=${t}`;
  },

  async renderToDataUrl(qrValue, size = 220) {
    return await QRCode.toDataURL(qrValue, { width: size, margin: 1 });
  },

  async printSingleLabel({ trackingNumber, origin, destination, customerName, totalItems }) {
    const qrValue = this.buildQrValue(trackingNumber);
    const qrDataUrl = await this.renderToDataUrl(qrValue);

    const html = `
<!doctype html>
<html>
<head>
<meta charset="utf-8"/>
<title>Atlas QR Label</title>
<style>
  body{font-family:Arial;margin:0;padding:18px}
  .label{width:360px;border:1px solid #111;padding:14px;border-radius:10px}
  .top{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px}
  .brand{font-weight:800;font-size:16px}
  .tn{font-size:18px;font-weight:800;margin:8px 0}
  .meta{font-size:12px;line-height:1.35;color:#111}
  img{display:block;margin-top:10px}
</style>
</head>
<body>
  <div class="label">
    <div class="top">
      <div class="brand">ATLAS</div>
      <div class="meta">${origin || ""} → ${destination || ""}</div>
    </div>
    <div class="tn">${trackingNumber}</div>
    <div class="meta">${customerName ? `Customer: ${customerName}<br/>` : ""}${totalItems ? `Items: ${totalItems}` : ""}</div>
    <img src="${qrDataUrl}" width="220" height="220"/>
  </div>
<script>window.print();</script>
</body></html>`;

    const w = window.open("", "_blank", "width=520,height=650");
    w.document.open();
    w.document.write(html);
    w.document.close();
  }
};
