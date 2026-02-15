const STATUS_MESSAGES = {
  LOADING:
    "Atlas Logistics: Your package is currently being loaded onto the delivery truck.",
  LOADED:
    "Atlas Logistics: Your package has been loaded and is ready for departure.",
  IN_TRANSIT:
    "Atlas Logistics: The truck has departed the warehouse and is on its way to your area.",
  ARRIVED:
    "Atlas Logistics: The truck has arrived at the local distribution center/hub.",
  COMPLETED:
    "Atlas Logistics: Delivery successful! Thank you for choosing Atlas.",
  CANCELLED:
    "Atlas Logistics: This trip has been cancelled. Please contact support for details.",

  // delay
  WEATHER:
    "Atlas Logistics: Shipments are slightly delayed due to bad weather conditions. We apologize for the inconvenience.",
  MECHANICAL:
    "Atlas Logistics: We are experiencing a minor mechanical issue with the transport vehicle. We are working to resolve it quickly.",
  PORT_CONGESTION:
    "Atlas Logistics: Your shipment is currently delayed due to high congestion at the port. We are working to clear it.",
  TRAFFIC:
    "Atlas Logistics: Delivery is delayed due to heavy traffic conditions on the route. Thank you for your patience.",

  DELAY_CLEARED:
    "Atlas Logistics: The delay has been resolved and your shipment is back on the move. Thank you for your patience.",
};

module.exports = {
  STATUS_MESSAGES,
};
