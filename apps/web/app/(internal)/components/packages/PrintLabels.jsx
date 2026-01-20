import QRCode from "react-qr-code"; // Run: npm install react-qr-code

export default function PrintLabels({ shipmentData, packages }) {
  // packages = [{ id: "AT-..-01", weight: 5, dest: "ODI" }, ...]

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="p-8 bg-white text-black">
      <div className="no-print mb-4 flex justify-between">
        <h2 className="text-xl font-bold">
          Generated Labels ({packages.length})
        </h2>
        <button
          onClick={handlePrint}
          className="bg-blue-600 text-white px-4 py-2 rounded"
        >
          Print Stickers
        </button>
      </div>

      {/* The Printable Area */}
      <div className="grid grid-cols-2 gap-4 print:block print:space-y-4">
        {packages.map((pkg) => (
          <div
            key={pkg.id}
            className="border-2 border-black p-4 flex gap-4 break-inside-avoid"
          >
            {/* Left: QR Code */}
            <div className="w-24 h-24 flex-shrink-0">
              <QRCode
                value={pkg.id} // The Scanner reads THIS ID
                size={96}
                level="M"
              />
            </div>

            {/* Right: Text Info */}
            <div className="flex-1 font-mono text-sm leading-tight">
              <div className="font-bold text-lg">{pkg.dest} HUB</div>
              <div className="text-xs mt-1">TRK: {pkg.id}</div>
              <div className="mt-2 font-bold">
                Box {pkg.sequence} of {pkg.total}
              </div>
              <div className="text-xs mt-1 truncate">
                {pkg.desc} ({pkg.weight}kg)
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* CSS for Printing */}
      <style jsx global>{`
        @media print {
          .no-print {
            display: none;
          }
          body {
            background: white;
          }
          .print\\:block {
            display: block;
          }
        }
      `}</style>
    </div>
  );
}
