export const FAQ_CATEGORIES = [
  "All",
  "Account",
  "Shipments",
  "Tracking",
  "Pickup",
  "Invoices",
  "Schedules",
  "Messages",
  "Support",
];

const faq = (id, category, question, blocks, keywords = "") => ({
  id: String(id),
  category,
  question,
  blocks,
  searchText: `${question} ${category} ${keywords} ${blocks
    .flatMap((block) => block.items || block.text || "")
    .join(" ")}`.toLowerCase(),
});

const ALL_FAQS = [
  faq(1, "Account", "How do I create an Atlas account?", [
    { text: "Open the Atlas Transport mobile application and tap Sign Up. Enter your personal information, email address, mobile number, home address, and create a password. Once your account is created, you can immediately start requesting shipments and tracking deliveries." },
  ], "sign up register"),
  faq(2, "Account", "How do I sign in?", [
    { text: "Open the app and enter the email address and password associated with your Atlas account." },
  ], "login"),
  faq(3, "Account", "I forgot my password. What should I do?", [
    { text: "Tap Forgot Password on the login screen. You can recover your account using your registered email address or mobile number. An OTP verification code will be sent before you can create a new password." },
  ], "reset recovery otp"),
  faq(4, "Account", "Can I change my password?", [
    { text: "Yes. Open Profile and select Change Password. Enter your current password, then create a new one." },
  ]),
  faq(5, "Account", "Can I update my personal information?", [
    { text: "Yes. You may update the following through the Profile screen:" },
    { items: ["Full name", "Mobile number", "Address", "Profile information"] },
  ], "edit profile"),
  faq(6, "Account", "Can I delete my account?", [
    { text: "Yes. The app allows permanent account deletion. Once deleted, your account cannot be recovered." },
  ]),

  faq(7, "Pickup", "How do I request a pickup?", [
    { text: "From the Home screen, tap Pickup or Create Shipment. Complete the sender and recipient information, add your package details, and submit your request. Your shipment will appear in My Shipments once it has been created." },
  ], "create shipment"),
  faq(8, "Pickup", "What information is required?", [
    { text: "A pickup request requires:" },
    { items: ["Sender name", "Sender phone number", "Sender address", "Recipient name", "Recipient phone number", "Recipient address", "Package description", "Package quantity"] },
    { text: "Optional:" },
    { items: ["Pickup location pin", "Special instructions"] },
  ]),
  faq(9, "Pickup", "Can I submit multiple packages?", [
    { text: "Yes. A shipment can contain multiple package items." },
  ]),
  faq(10, "Pickup", "Can I cancel my pickup request?", [
    { text: "Yes. You can cancel a pickup request only while its status is Pending Pickup. Once the shipment has started processing, it can no longer be cancelled through the app." },
  ]),
  faq(11, "Pickup", "What happens after I submit my pickup request?", [
    { text: "Atlas automatically creates your shipment and assigns a unique tracking number. Your shipment will appear in My Shipments with the status Pending Pickup." },
  ]),

  faq(12, "Tracking", "How do I track my shipment?", [
    { text: "Open My Shipments and tap the shipment you want to monitor. You can view its latest status, shipment progress, delivery timeline, and tracking history." },
  ]),
  faq(13, "Tracking", "Can I add an existing shipment to my account?", [
    { text: "Yes. Tap Add Tracking Number and enter the shipment's tracking number." },
  ], "link tracking"),
  faq(14, "Tracking", "Why can't I add my tracking number?", [
    { text: "Possible reasons include:" },
    { items: ["Invalid tracking number", "Shipment not found", "Shipment already added", "Your phone number doesn't match the shipment's sender or recipient"] },
  ]),

  faq(15, "Shipments", "What shipment information can I view?", [
    { text: "The Shipment Details screen includes:" },
    { items: ["Tracking Number", "Shipment Status", "Sender", "Recipient", "Pickup Address", "Delivery Address", "Shipment Progress", "Delivery Timeline"] },
  ]),
  faq(16, "Shipments", "What shipment statuses are available?", [
    { text: "Your shipment may go through the following statuses:" },
    { items: ["Pending Pickup", "Picked Up", "Received at Hub", "Loaded", "In Transit", "Ready for Delivery", "Out for Delivery", "Delivered", "Cancelled"] },
    { text: "These statuses help you track your shipment from pickup to final delivery." },
  ]),
  faq(17, "Shipments", "Can I filter my shipments?", [
    { text: "Yes. Available filters include:" },
    { items: ["All", "Active", "Pending", "In Transit", "Delivered", "Cancelled"] },
  ]),
  faq(18, "Shipments", "Can I search for a shipment?", [
    { text: "Yes. Search using:" },
    { items: ["Tracking Number", "Sender Name", "Recipient Name", "Destination"] },
  ]),

  faq(19, "Schedules", "Where can I see my trip schedules?", [
    { text: "Tap Schedule from the Home screen. Upcoming pickup and delivery schedules will appear automatically once your shipment has been assigned to a delivery trip." },
  ]),
  faq(20, "Schedules", "What information is displayed in a schedule?", [
    { text: "Each schedule displays:" },
    { items: ["Pickup Date", "Pickup Time", "Delivery Time", "Pickup Location", "Destination", "Shipment Number", "Schedule Status"] },
  ]),
  faq(21, "Schedules", "Why don't I have any schedules yet?", [
    { text: "Schedules become available only after your shipment has been assigned to a scheduled delivery trip." },
  ]),
  faq(22, "Schedules", "Can I open my shipment from the schedule?", [
    { text: "Yes. Selecting a schedule opens the Shipment Details page associated with that schedule." },
  ]),

  faq(23, "Invoices", "When will my invoice appear?", [
    { text: "Invoices are generated after your shipment has been completed and billed. Once available, you can view your invoice in the Invoices section." },
  ]),
  faq(24, "Invoices", "What information is shown in an invoice?", [
    { text: "Each invoice contains:" },
    { items: ["Invoice Number", "Shipment Number", "Date", "Amount", "Invoice Status"] },
  ]),
  faq(25, "Invoices", "What invoice statuses are available?", [
    { text: "Invoice statuses include:" },
    { items: ["Paid", "Pending", "Overdue"] },
  ]),
  faq(26, "Invoices", "Why don't I have any invoices?", [
    { text: "Invoices become available only after shipment completion and billing." },
  ]),

  faq(27, "Messages", "How do I contact Atlas Support?", [
    { text: "Open Messages and start a new conversation with Atlas Support." },
  ], "chat"),
  faq(28, "Messages", "What concern categories are available?", [
    { text: "You can choose:" },
    { items: ["Delivery Status", "Delivery Concern", "Change Delivery", "Other Concerns"] },
  ]),
  faq(29, "Messages", "Can I send pictures?", [
    { text: "Yes. You may attach images during your conversation." },
  ], "photos attachments"),
  faq(30, "Messages", "Can I send files?", [
    { text: "Yes. Documents and supported files may also be attached." },
  ], "documents attachments"),
  faq(31, "Messages", "Can I make voice calls?", [
    { text: "Yes. Voice calling is available inside active support conversations." },
  ]),
  faq(32, "Messages", "Can I make video calls?", [
    { text: "Yes. Video calling is also supported within customer support conversations." },
  ]),
  faq(33, "Messages", "Why can't I send messages anymore?", [
    { text: "If the conversation has already been closed by customer support, it becomes read-only." },
  ]),
  faq(34, "Messages", "Can I continue chatting after a conversation is closed?", [
    { text: "No. A closed conversation cannot receive new messages or calls." },
  ]),

  faq(35, "Shipments", "What notifications will I receive?", [
    { text: "You may receive notifications for:" },
    { items: ["Shipment In Transit", "Out for Delivery", "Delivered", "Delivery Attempt Failed"] },
  ]),
  faq(36, "Shipments", "Is my shipment information updated in real time?", [
    { text: "Yes. Shipment progress updates as new shipment events are recorded." },
  ]),
  faq(37, "Shipments", "Can I view completed shipments?", [
    { text: "Yes. Completed deliveries remain available in My Shipments." },
  ]),
  faq(38, "Support", "How can I contact customer support?", [
    { text: "Go to the Messages tab and start a conversation with Atlas Customer Support. You can send messages, images, attachments, and, when available, make voice or video calls." },
  ]),
  faq(39, "Support", "Is there a limit to how many shipments I can track?", [
    { text: "No fixed limit is shown in the customer application." },
  ]),
  faq(40, "Support", "Why is a feature unavailable?", [
    { text: "Some features become available only after certain shipment events occur. For example:" },
    { items: ["Schedules appear only after trip assignment.", "Invoices appear only after billing.", "Messaging may become read-only once a conversation has been closed."] },
  ]),
];

const FEATURED_FAQ_IDS = ["12", "7", "23", "38", "10", "16"];

export const FAQS = [
  ...FEATURED_FAQ_IDS.map((id) => ALL_FAQS.find((item) => item.id === id)),
  ...ALL_FAQS.filter((item) => !FEATURED_FAQ_IDS.includes(item.id)),
];
