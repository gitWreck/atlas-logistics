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
};

module.exports = {
  STATUS_MESSAGES,
};
