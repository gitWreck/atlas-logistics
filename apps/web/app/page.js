import { useState, useEffect } from "react";

export default function Home() {
  const [trackingNumber, setTrackingNumber] = useState("");
  const [isMobile, setIsMobile] = useState(false);
  const [pickupForm, setPickupForm] = useState({
    fullName: "",
    phone: "",
    email: "",
    pickupAddress: "",
    deliveryAddress: "",
    packageDetails: "",
  });

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };

    handleResize();
    window.addEventListener("resize", handleResize);

    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const handleTrackSubmit = (e) => {
    e.preventDefault();
    alert(`Track shipment: ${trackingNumber}`);
  };

  const handlePickupSubmit = (e) => {
    e.preventDefault();
    alert("Pickup request submitted.");
  };

  const handlePickupChange = (e) => {
    const { name, value } = e.target;
    setPickupForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        background:
          "linear-gradient(180deg, #f8fbff 0%, #f3f6fb 35%, #eef3f9 100%)",
        fontFamily: "Inter, Arial, sans-serif",
        padding: isMobile ? "16px 14px 60px" : "24px 20px 80px",
        color: "#0f172a",
      }}
    >
      <div style={{ maxWidth: "1320px", margin: "0 auto" }}>
        {/* TOP NAVBAR */}
        <nav
          style={{
            background: "rgba(255,255,255,0.88)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            border: "1px solid rgba(226,232,240,0.9)",
            boxShadow: "0 10px 30px rgba(15, 23, 42, 0.05)",
            borderRadius: "22px",
            padding: isMobile ? "16px" : "16px 22px",
            marginBottom: "24px",
            display: "flex",
            flexDirection: isMobile ? "column" : "row",
            alignItems: isMobile ? "flex-start" : "center",
            justifyContent: "space-between",
            gap: "16px",
            flexWrap: "wrap",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
            }}
          >
            <img
              src="/Atlas.png"
              alt="Atlas Logo"
              style={{
                width: "42px",
                height: "42px",
                objectFit: "contain",
              }}
            />
            <div>
              <p
                style={{
                  margin: 0,
                  fontSize: "15px",
                  fontWeight: 800,
                  color: "#020617",
                }}
              >
                Atlas Transport Corporation
              </p>
              <p
                style={{
                  margin: "2px 0 0",
                  fontSize: "12px",
                  color: "#64748b",
                }}
              >
                Fast & Easy Shipping
              </p>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: isMobile ? "12px" : "18px",
              flexWrap: "wrap",
            }}
          >
            <a href="#tracking" style={navLinkStyle}>
              Tracking
            </a>
            <a href="#schedule" style={navLinkStyle}>
              Schedule
            </a>
            <a href="#warehouses" style={navLinkStyle}>
              Warehouses
            </a>
            <a href="#pickup" style={navLinkStyle}>
              Book Pickup
            </a>
          </div>
        </nav>

        {/* HERO */}
        <section
          style={{
            background: "linear-gradient(135deg, #ffffff 0%, #f8fbff 100%)",
            borderRadius: isMobile ? "24px" : "32px",
            padding: isMobile ? "36px 18px 22px" : "64px 42px 42px",
            boxShadow: "0 18px 50px rgba(15, 23, 42, 0.07)",
            border: "1px solid #e2e8f0",
            marginBottom: "28px",
            overflow: "hidden",
            position: "relative",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: "-120px",
              right: "-60px",
              width: isMobile ? "180px" : "280px",
              height: isMobile ? "180px" : "280px",
              borderRadius: "999px",
              background: "rgba(37, 99, 235, 0.06)",
              pointerEvents: "none",
            }}
          />
          <div
            style={{
              position: "absolute",
              bottom: "-140px",
              left: "-90px",
              width: isMobile ? "220px" : "320px",
              height: isMobile ? "220px" : "320px",
              borderRadius: "999px",
              background: "rgba(15, 23, 42, 0.04)",
              pointerEvents: "none",
            }}
          />

          <div style={{ position: "relative", zIndex: 1 }}>
            <header
              style={{
                marginBottom: "34px",
                textAlign: "center",
              }}
            >
              <img
                src="/Atlas.png"
                alt="Atlas Logo"
                style={{
                  width: isMobile ? "96px" : "140px",
                  marginBottom: "20px",
                }}
              />

              <h1
                style={{
                  fontSize: isMobile ? "36px" : "64px",
                  fontWeight: "800",
                  margin: "0",
                  color: "#020617",
                  letterSpacing: "-0.02em",
                  lineHeight: 1.05,
                }}
              >
                Atlas Transport Corporation
              </h1>

              <p
                style={{
                  marginTop: "14px",
                  fontSize: isMobile ? "18px" : "20px",
                  color: "#475569",
                  lineHeight: 1.6,
                  fontWeight: "500",
                }}
              >
                Fast & Easy Shipping
              </p>

              <p
                style={{
                  margin: "18px auto 0",
                  fontSize: isMobile ? "15px" : "18px",
                  lineHeight: 1.85,
                  color: "#475569",
                  maxWidth: "840px",
                }}
              >
                Reliable cargo movement, warehouse coordination, shipment
                tracking, and pickup requests for customers who need organized,
                professional logistics support.
              </p>

              {/* HERO TRACKING */}
              <form
                onSubmit={handleTrackSubmit}
                style={{
                  margin: "34px auto 0",
                  maxWidth: "820px",
                  background: "#ffffff",
                  border: "1px solid #dbe4ef",
                  boxShadow: "0 14px 30px rgba(15, 23, 42, 0.06)",
                  borderRadius: "20px",
                  padding: "14px",
                  display: "grid",
                  gridTemplateColumns: isMobile ? "1fr" : "1fr auto auto",
                  gap: "12px",
                }}
              >
                <input
                  type="text"
                  placeholder="Enter your tracking number"
                  value={trackingNumber}
                  onChange={(e) => setTrackingNumber(e.target.value)}
                  style={inputStyle}
                />

                <button
                  type="submit"
                  style={{
                    padding: "16px 22px",
                    borderRadius: "14px",
                    border: "none",
                    background: "#0f172a",
                    color: "#ffffff",
                    fontSize: "15px",
                    fontWeight: 700,
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                  }}
                >
                  Track Shipment
                </button>

                <a
                  href="#pickup"
                  style={{
                    textDecoration: "none",
                    padding: "16px 22px",
                    borderRadius: "14px",
                    border: "1px solid #bfdbfe",
                    background: "#eff6ff",
                    color: "#1d4ed8",
                    fontSize: "15px",
                    fontWeight: 700,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    whiteSpace: "nowrap",
                  }}
                >
                  Request Pickup
                </a>
              </form>
            </header>

            <div
              style={{
                maxWidth: "980px",
                margin: "0 auto",
                display: "grid",
                gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1fr",
                gap: "16px",
              }}
            >
              <div style={heroInfoCardStyle}>
                <p style={heroInfoLabelStyle}>Business Phone</p>
                <p style={heroInfoValueStyle}>+63 912 545 3219</p>
              </div>

              <div style={heroInfoCardStyle}>
                <p style={heroInfoLabelStyle}>Customer Support</p>
                <p style={heroInfoValueStyle}>support@atlastransport.ph</p>
              </div>

              <div style={heroInfoCardStyle}>
                <p style={heroInfoLabelStyle}>General Email</p>
                <p style={heroInfoValueStyle}>info@atlastransport.ph</p>
              </div>
            </div>
          </div>
        </section>

        {/* TRACKING SECTION */}
        <section
          id="tracking"
          style={{
            background: "#ffffff",
            borderRadius: isMobile ? "22px" : "28px",
            padding: isMobile ? "22px 18px" : "34px",
            boxShadow: "0 10px 30px rgba(15, 23, 42, 0.05)",
            border: "1px solid #e2e8f0",
            marginBottom: "28px",
          }}
        >
          <p style={sectionEyebrowStyle}>Shipment Tracking</p>

          <h2
            style={{
              ...sectionTitleStyle,
              fontSize: isMobile ? "30px" : sectionTitleStyle.fontSize,
            }}
          >
            Track Your Shipment
          </h2>

          <p style={sectionDescStyle}>
            Enter your tracking number below to check the latest shipment
            status.
          </p>

          <form
            onSubmit={handleTrackSubmit}
            style={{
              display: "grid",
              gridTemplateColumns: isMobile ? "1fr" : "1fr auto",
              gap: "14px",
            }}
          >
            <input
              type="text"
              placeholder="Enter tracking number"
              value={trackingNumber}
              onChange={(e) => setTrackingNumber(e.target.value)}
              style={inputStyle}
            />
            <button
              type="submit"
              style={{
                padding: "16px 24px",
                borderRadius: "14px",
                border: "none",
                background: "#0f172a",
                color: "#ffffff",
                fontSize: "15px",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Track Now
            </button>
          </form>
        </section>

        {/* SCHEDULE */}
        <section
          id="schedule"
          style={{
            background: "linear-gradient(135deg, #e9f1fb 0%, #dfe7f2 100%)",
            borderRadius: isMobile ? "24px" : "34px",
            padding: isMobile ? "22px 18px" : "34px",
            boxShadow: "0 8px 20px rgba(15, 23, 42, 0.06)",
            border: "1px solid #cfd8e3",
            marginBottom: "28px",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: "20px",
              alignItems: "flex-start",
              flexWrap: "wrap",
              marginBottom: "24px",
              flexDirection: isMobile ? "column" : "row",
            }}
          >
            <div>
              <p style={sectionEyebrowBlueStyle}>Truck Schedule</p>

              <h2
                style={{
                  margin: 0,
                  fontSize: isMobile ? "30px" : "42px",
                  fontWeight: 800,
                  lineHeight: 1.1,
                }}
              >
                Divisoria Schedule
              </h2>

              <p
                style={{
                  margin: "14px 0 0",
                  color: "#475569",
                  fontSize: "16px",
                  lineHeight: 1.8,
                  maxWidth: "720px",
                }}
              >
                View the current movement schedule between the warehouse and
                Tablas for better planning and coordination.
              </p>
            </div>

            <div
              style={{
                background: "#ffffff",
                borderRadius: "22px",
                padding: "18px 22px",
                minWidth: isMobile ? "100%" : "240px",
                width: isMobile ? "100%" : "auto",
                boxShadow: "0 8px 20px rgba(15, 23, 42, 0.05)",
                border: "1px solid #d6dce7",
                boxSizing: "border-box",
              }}
            >
              <p
                style={{
                  margin: "0 0 8px",
                  fontSize: "12px",
                  letterSpacing: "0.22em",
                  textTransform: "uppercase",
                  color: "#64748b",
                }}
              >
                Schedule Contacts
              </p>
              <p style={{ margin: "0 0 4px", fontWeight: 700, fontSize: "16px" }}>
                Lean Mangaoil
              </p>
              <p style={{ margin: "0 0 10px", color: "#475569", fontSize: "14px" }}>
                09757427941
              </p>
              <p style={{ margin: "0 0 4px", fontWeight: 700, fontSize: "16px" }}>
                Roselyn Hindap
              </p>
              <p style={{ margin: 0, color: "#475569", fontSize: "14px" }}>
                09125453219
              </p>
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
              gap: "20px",
            }}
          >
            <div style={scheduleCardStyle}>
              <p style={scheduleLabelStyle}>Departure Divisoria</p>
              <h3
                style={{
                  margin: "0 0 18px",
                  fontSize: isMobile ? "24px" : "28px",
                  fontWeight: 800,
                  color: "#020617",
                }}
              >
                Weekly Departures
              </h3>

              <div style={pillWrapStyle}>
                {["Tuesday", "Wednesday", "Thursday", "Saturday"].map((day) => (
                  <span key={day} style={dayPillStyle}>
                    {day}
                  </span>
                ))}
              </div>
            </div>

            <div style={scheduleCardStyle}>
              <p style={scheduleLabelStyle}>Arrival in Tablas</p>
              <h3
                style={{
                  margin: "0 0 18px",
                  fontSize: isMobile ? "24px" : "28px",
                  fontWeight: 800,
                  color: "#020617",
                }}
              >
                Estimated Arrivals
              </h3>

              <div style={pillWrapStyle}>
                {["Thursday", "Friday", "Saturday", "Monday"].map((day) => (
                  <span key={day} style={dayPillStyle}>
                    {day}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* WAREHOUSES */}
        <section
          id="warehouses"
          style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
            gap: "28px",
            marginBottom: "28px",
          }}
        >
          <div style={warehouseCardStyle}>
            <p style={warehouseEyebrowStyle}>Warehouse Information</p>

            <h2
              style={{
                ...warehouseTitleStyle,
                fontSize: isMobile ? "30px" : warehouseTitleStyle.fontSize,
              }}
            >
              Divisoria Warehouse
            </h2>

            <iframe
              title="Divisoria Warehouse"
              src="https://www.google.com/maps?q=619+Asuncion+St+Binondo+Manila&output=embed"
              style={{
                width: "100%",
                height: "180px",
                border: "none",
                borderRadius: "20px",
                marginBottom: "20px",
              }}
              loading="lazy"
            />

            <div style={warehouseInfoBlockStyle}>
              <p style={warehouseInfoLabelStyle}>Address</p>
              <p style={warehouseInfoValueStyle}>
                619 Asuncion St, Binondo, Manila, Metro Manila, Philippines
              </p>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
                gap: "20px",
              }}
            >
              <div style={warehouseSmallCardStyle}>
                <p style={warehouseInfoLabelStyle}>Contact Person</p>
                <p style={warehouseSmallValueStyle}>Lean Mangaoil</p>
              </div>

              <div style={warehouseSmallCardStyle}>
                <p style={warehouseInfoLabelStyle}>Phone Number</p>
                <p style={warehouseSmallValueStyle}>09757427941</p>
              </div>
            </div>
          </div>

          <div style={warehouseCardStyle}>
            <p style={warehouseEyebrowStyle}>Warehouse Information</p>

            <h2
              style={{
                ...warehouseTitleStyle,
                fontSize: isMobile ? "30px" : warehouseTitleStyle.fontSize,
              }}
            >
              Odiongan Warehouse
            </h2>

            <iframe
              title="Odiongan Warehouse"
              src="https://www.google.com/maps?q=Poctoy+Odiongan+Romblon&output=embed"
              style={{
                width: "100%",
                height: "180px",
                border: "none",
                borderRadius: "20px",
                marginBottom: "20px",
              }}
              loading="lazy"
            />

            <div style={warehouseInfoBlockStyle}>
              <p style={warehouseInfoLabelStyle}>Address</p>
              <p style={warehouseInfoValueStyle}>
                Poctoy, Poctoy, Odiongan, Romblon, 5505
              </p>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
                gap: "20px",
              }}
            >
              <div style={warehouseSmallCardStyle}>
                <p style={warehouseInfoLabelStyle}>Contact Person</p>
                <p style={warehouseSmallValueStyle}>
                  Roselyn Merculesio Hindap
                </p>
              </div>

              <div style={warehouseSmallCardStyle}>
                <p style={warehouseInfoLabelStyle}>Phone Number</p>
                <p style={warehouseSmallValueStyle}>09125453219</p>
              </div>
            </div>
          </div>
        </section>

        {/* REQUEST PICKUP */}
        <section
          id="pickup"
          style={{
            background: "#ffffff",
            borderRadius: isMobile ? "22px" : "28px",
            padding: isMobile ? "22px 18px" : "34px",
            boxShadow: "0 10px 30px rgba(15, 23, 42, 0.05)",
            border: "1px solid #e2e8f0",
            marginBottom: "28px",
          }}
        >
          <p style={sectionEyebrowStyle}>Pickup Request</p>

          <h2
            style={{
              ...sectionTitleStyle,
              fontSize: isMobile ? "30px" : sectionTitleStyle.fontSize,
            }}
          >
            Request a Pickup
          </h2>

          <p style={sectionDescStyle}>
            Fill out the form below and our team will coordinate your pickup
            request.
          </p>

          <form
            onSubmit={handlePickupSubmit}
            style={{
              display: "grid",
              gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
              gap: "16px",
            }}
          >
            <input
              name="fullName"
              placeholder="Full name"
              value={pickupForm.fullName}
              onChange={handlePickupChange}
              style={inputStyle}
            />
            <input
              name="phone"
              placeholder="Phone number"
              value={pickupForm.phone}
              onChange={handlePickupChange}
              style={inputStyle}
            />
            <input
              name="email"
              placeholder="Email address"
              value={pickupForm.email}
              onChange={handlePickupChange}
              style={inputStyle}
            />
            <input
              name="deliveryAddress"
              placeholder="Delivery address"
              value={pickupForm.deliveryAddress}
              onChange={handlePickupChange}
              style={inputStyle}
            />
            <input
              name="pickupAddress"
              placeholder="Pickup address"
              value={pickupForm.pickupAddress}
              onChange={handlePickupChange}
              style={{ ...inputStyle, gridColumn: "1 / -1" }}
            />
            <textarea
              name="packageDetails"
              placeholder="Package details"
              value={pickupForm.packageDetails}
              onChange={handlePickupChange}
              rows={5}
              style={{
                ...inputStyle,
                gridColumn: "1 / -1",
                resize: "vertical",
                paddingTop: "16px",
                fontFamily: "Inter, Arial, sans-serif",
              }}
            />

            <div style={{ gridColumn: "1 / -1" }}>
              <button
                type="submit"
                style={{
                  width: isMobile ? "100%" : "auto",
                  padding: "16px 24px",
                  borderRadius: "14px",
                  border: "none",
                  background: "#2563eb",
                  color: "#ffffff",
                  fontSize: "15px",
                  fontWeight: 700,
                  cursor: "pointer",
                  boxShadow: "0 10px 20px rgba(37, 99, 235, 0.18)",
                }}
              >
                Submit Pickup Request
              </button>
            </div>
          </form>
        </section>

        {/* SUPPORT STRIP */}
        <section
          style={{
            background: "#0f172a",
            color: "#ffffff",
            borderRadius: isMobile ? "22px" : "28px",
            padding: isMobile ? "22px 18px" : "28px 30px",
            marginBottom: "20px",
            display: "grid",
            gridTemplateColumns: isMobile ? "1fr" : "1.2fr 1fr 1fr",
            gap: "20px",
            alignItems: "center",
          }}
        >
          <div>
            <p
              style={{
                margin: "0 0 10px",
                fontSize: "12px",
                letterSpacing: "0.22em",
                textTransform: "uppercase",
                color: "#93c5fd",
              }}
            >
              Atlas Support
            </p>
            <h3
              style={{
                margin: 0,
                fontSize: isMobile ? "24px" : "28px",
                lineHeight: 1.2,
                fontWeight: 800,
              }}
            >
              Need help with your shipment?
            </h3>
          </div>

          <div>
            <p style={supportLabelStyle}>Business Phone</p>
            <p style={supportValueStyle}>+63 912 545 3219</p>
          </div>

          <div>
            <p style={supportLabelStyle}>Customer Support</p>
            <p style={supportValueStyle}>support@atlastransport.ph</p>
            <p style={{ ...supportValueStyle, marginTop: "8px" }}>
              info@atlastransport.ph
            </p>
          </div>
        </section>

        <footer
          style={{
            textAlign: "center",
            color: "#64748b",
            fontSize: "14px",
            paddingTop: "12px",
          }}
        >
          © 2026 Atlas Transport Corporation. All rights reserved.
        </footer>
      </div>
    </main>
  );
}

const navLinkStyle = {
  textDecoration: "none",
  color: "#334155",
  fontSize: "14px",
  fontWeight: 600,
};

const heroInfoCardStyle = {
  background: "rgba(255,255,255,0.92)",
  border: "1px solid #e2e8f0",
  borderRadius: "20px",
  padding: "18px 20px",
  boxShadow: "0 10px 20px rgba(15, 23, 42, 0.04)",
};

const heroInfoLabelStyle = {
  margin: "0 0 8px",
  fontSize: "12px",
  letterSpacing: "0.18em",
  textTransform: "uppercase",
  color: "#64748b",
};

const heroInfoValueStyle = {
  margin: 0,
  color: "#0f172a",
  fontWeight: 700,
  fontSize: "16px",
};

const sectionEyebrowStyle = {
  margin: "0 0 10px",
  fontSize: "13px",
  letterSpacing: "0.22em",
  textTransform: "uppercase",
  color: "#2563eb",
  fontWeight: 600,
};

const sectionEyebrowBlueStyle = {
  margin: "0 0 10px",
  fontSize: "13px",
  letterSpacing: "0.22em",
  textTransform: "uppercase",
  color: "#1d4ed8",
  fontWeight: 600,
};

const sectionTitleStyle = {
  margin: "0 0 14px",
  fontSize: "40px",
  lineHeight: 1.1,
  fontWeight: 800,
};

const sectionDescStyle = {
  margin: "0 0 24px",
  color: "#475569",
  fontSize: "16px",
  lineHeight: 1.8,
  maxWidth: "760px",
};

const scheduleCardStyle = {
  background: "#ffffff",
  borderRadius: "24px",
  padding: "28px",
  border: "1px solid #d8dee8",
  boxShadow: "0 10px 24px rgba(15, 23, 42, 0.04)",
};

const scheduleLabelStyle = {
  margin: "0 0 12px",
  fontSize: "13px",
  letterSpacing: "0.22em",
  textTransform: "uppercase",
  color: "#5474a6",
  fontWeight: 600,
};

const pillWrapStyle = {
  display: "flex",
  flexWrap: "wrap",
  gap: "12px",
};

const dayPillStyle = {
  background: "#eff6ff",
  color: "#1d4ed8",
  border: "1px solid #bfdbfe",
  borderRadius: "999px",
  padding: "12px 18px",
  fontSize: "15px",
  fontWeight: 700,
};

const warehouseCardStyle = {
  background: "linear-gradient(180deg, #ffffff 0%, #f8fbff 100%)",
  borderRadius: "34px",
  padding: "40px",
  boxShadow: "0 8px 24px rgba(15, 23, 42, 0.05)",
  border: "1px solid #d8dee8",
};

const warehouseEyebrowStyle = {
  margin: "0 0 12px",
  fontSize: "13px",
  letterSpacing: "0.22em",
  textTransform: "uppercase",
  color: "#5474a6",
  fontWeight: 600,
};

const warehouseTitleStyle = {
  margin: "0 0 22px",
  fontSize: "42px",
  lineHeight: 1.1,
  fontWeight: 800,
};

const warehouseInfoBlockStyle = {
  background: "#eef3f8",
  borderRadius: "22px",
  padding: "26px",
  marginBottom: "20px",
};

const warehouseSmallCardStyle = {
  background: "#eef3f8",
  borderRadius: "22px",
  padding: "26px",
};

const warehouseInfoLabelStyle = {
  margin: "0 0 10px",
  fontSize: "12px",
  letterSpacing: "0.22em",
  textTransform: "uppercase",
  color: "#5474a6",
};

const warehouseInfoValueStyle = {
  margin: 0,
  fontSize: "19px",
  lineHeight: 1.7,
  color: "#334155",
  fontWeight: 500,
};

const warehouseSmallValueStyle = {
  margin: 0,
  fontSize: "18px",
  color: "#334155",
  fontWeight: 600,
};

const supportLabelStyle = {
  margin: "0 0 8px",
  fontSize: "12px",
  letterSpacing: "0.18em",
  textTransform: "uppercase",
  color: "#93c5fd",
};

const supportValueStyle = {
  margin: 0,
  fontSize: "16px",
  fontWeight: 700,
  color: "#ffffff",
};

const inputStyle = {
  width: "100%",
  padding: "16px 18px",
  borderRadius: "14px",
  border: "1px solid #cbd5e1",
  fontSize: "16px",
  outline: "none",
  boxSizing: "border-box",
};
