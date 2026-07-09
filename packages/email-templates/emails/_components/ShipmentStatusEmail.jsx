import React from "react";
import {
  Body,
  Button,
  Column,
  Container,
  Head,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Row,
  Section,
  Text,
} from "@react-email/components";
import { colors, getStatusBadgeStyle } from "./theme";
import { getIconUrls } from "./icons.js";

const PACKAGES_PER_PAGE = 5;

export function ShipmentStatusEmail({
  customerName = "Customer",
  statusLabel = "Shipment Update",
  statusCode = "IN_TRANSIT",
  shipmentId = "",
  routeLabel = "",
  originLabel = "",
  destinationLabel = "",
  lastUpdated = "",
  summaryHeadline = "",
  summarySubtext = "",
  deliveredCount = 0,
  outForDeliveryCount = 0,
  totalPackages = 0,
  packages = [],
  trackingUrl = "https://atlastransport.ph/track",
  supportEmail = "support@atlastransport.ph",
  logoUrl = "https://atlas-tracking.web.app/email/atlas-logo.jpeg",
  iconBaseUrl = "https://atlastransport.ph/email",
  isMultiShipment = false,
  shipmentIds = [],
}) {
  const icons = getIconUrls(iconBaseUrl);
  const badgeStyle = getStatusBadgeStyle(statusCode);
  const totalPackageRows = packages.length;
  const visiblePackages = packages.slice(0, PACKAGES_PER_PAGE);
  const hasMorePackages = totalPackageRows > PACKAGES_PER_PAGE;
  const previewText = `${statusLabel} — ${shipmentId || "Atlas shipment update"}`;

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={main}>
        <Container style={container}>
          {/* Header */}
          <Section style={header}>
            <Row>
              <Column>
                <Img
                  src={logoUrl}
                  width="120"
                  height="120"
                  alt="Atlas Transportation — Fast and Easy Shipping"
                  style={logo}
                />
              </Column>
            </Row>
          </Section>

          <Section style={contentSection}>
            <Text style={greeting}>Hi {customerName},</Text>
            <Text style={intro}>
              Here&apos;s the latest update on your shipment.
            </Text>
          </Section>

          {/* Status card */}
          <Section style={contentSection}>
            <Section style={statusCard}>
              <Row>
                <Column style={{ width: "68%", verticalAlign: "top" }}>
                  <Text
                    style={{
                      ...statusBadge,
                      backgroundColor: badgeStyle.backgroundColor,
                      color: badgeStyle.color,
                    }}
                  >
                    {statusLabel}
                  </Text>
                  <Text style={shipmentIdText}>{shipmentId}</Text>
                  {routeLabel ? (
                    <Text style={metaText}>
                      <span style={metaLabel}>Route:</span> {routeLabel}
                    </Text>
                  ) : null}
                  {originLabel ? (
                    <Text style={metaText}>
                      <span style={metaLabel}>Origin:</span> {originLabel}
                    </Text>
                  ) : null}
                  {destinationLabel ? (
                    <Text style={metaText}>
                      <span style={metaLabel}>Destination:</span>{" "}
                      {destinationLabel}
                    </Text>
                  ) : null}
                  {isMultiShipment && shipmentIds.length > 1 ? (
                    <Text style={metaText}>
                      <span style={metaLabel}>Shipments:</span>{" "}
                      {shipmentIds.join(", ")}
                    </Text>
                  ) : null}
                </Column>
                {lastUpdated ? (
                  <Column style={{ width: "32%", verticalAlign: "top" }}>
                    <Section style={lastUpdatedBox}>
                      <Text style={lastUpdatedLabel}>Last Updated</Text>
                      <Text style={lastUpdatedValue}>{lastUpdated}</Text>
                    </Section>
                  </Column>
                ) : null}
              </Row>
            </Section>
          </Section>

          {/* Summary */}
          {!isMultiShipment && totalPackages > 0 ? (
            <Section style={contentSection}>
              <Section style={summaryCard}>
                <Row>
                  <Column style={summaryMainColumn}>
                    <Text style={sectionEyebrow}>SHIPMENT SUMMARY</Text>
                    {deliveredCount > 0 && totalPackages > 0 ? (
                      <Text style={summaryHeadlineStyle}>
                        <span style={summaryHighlight}>{deliveredCount}</span>
                        <span style={summaryHeadlineSuffix}>
                          {` of ${totalPackages} package${totalPackages === 1 ? "" : "s"} delivered`}
                        </span>
                      </Text>
                    ) : summaryHeadline ? (
                      <Text style={summaryHeadlineStyle}>{summaryHeadline}</Text>
                    ) : null}
                    {outForDeliveryCount > 0 ? (
                      <Text style={summarySubtextStyle}>
                        {`Your remaining package${outForDeliveryCount === 1 ? "" : "s"} ${outForDeliveryCount === 1 ? "is" : "are"} `}
                        <Link href={trackingUrl} style={summaryLink}>
                          out for delivery.
                        </Link>
                      </Text>
                    ) : summarySubtext ? (
                      <Text style={summarySubtextStyle}>{summarySubtext}</Text>
                    ) : null}
                  </Column>

                  <Column style={summaryStatColumn}>
                    <Row style={summaryStatHeaderRow}>
                      <Column style={summaryStatIconCol}>
                        <Img
                          src={icons.checkDelivered}
                          width="18"
                          height="18"
                          alt=""
                          style={summaryStatIcon}
                        />
                      </Column>
                      <Column style={summaryStatLabelCol}>
                        <Text style={summaryStatHeaderLabel}>Delivered</Text>
                      </Column>
                    </Row>
                    <Text
                      style={{
                        ...summaryStatNumber,
                        color: colors.green600,
                      }}
                    >
                      {deliveredCount}
                    </Text>
                    <Text style={summaryStatUnit}>
                      {`Package${deliveredCount === 1 ? "" : "s"}`}
                    </Text>
                  </Column>

                  <Column style={summaryStatColumn}>
                    <Row style={summaryStatHeaderRow}>
                      <Column style={summaryStatIconCol}>
                        <Img
                          src={icons.truckOut}
                          width="18"
                          height="18"
                          alt=""
                          style={summaryStatIcon}
                        />
                      </Column>
                      <Column style={summaryStatLabelCol}>
                        <Text style={summaryStatHeaderLabel}>
                          Out for Delivery
                        </Text>
                      </Column>
                    </Row>
                    <Text
                      style={{
                        ...summaryStatNumber,
                        color: colors.purple700,
                      }}
                    >
                      {outForDeliveryCount}
                    </Text>
                    <Text style={summaryStatUnit}>
                      {`Package${outForDeliveryCount === 1 ? "" : "s"}`}
                    </Text>
                  </Column>

                  <Column style={summaryStatColumn}>
                    <Row style={summaryStatHeaderRow}>
                      <Column style={summaryStatIconCol}>
                        <Img
                          src={icons.packageTotal}
                          width="18"
                          height="18"
                          alt=""
                          style={summaryStatIcon}
                        />
                      </Column>
                      <Column style={summaryStatLabelCol}>
                        <Text style={summaryStatHeaderLabel}>
                          Total Packages
                        </Text>
                      </Column>
                    </Row>
                    <Text
                      style={{
                        ...summaryStatNumber,
                        color: colors.navy,
                      }}
                    >
                      {totalPackages}
                    </Text>
                    <Text style={summaryStatUnit}>
                      {`Package${totalPackages === 1 ? "" : "s"}`}
                    </Text>
                  </Column>
                </Row>
              </Section>
            </Section>
          ) : null}

          {/* Package table */}
          {!isMultiShipment && visiblePackages.length > 0 ? (
            <Section style={contentSection}>
              <Text style={sectionTitle}>PACKAGE / ITEM DETAILS</Text>
              <Section style={tableWrapper}>
                <Row style={tableHeaderRow}>
                  <Column style={{ ...tableHeaderCell, width: "6%" }}>#</Column>
                  <Column style={{ ...tableHeaderCell, width: "30%" }}>
                    Package / Item
                  </Column>
                  <Column style={{ ...tableHeaderCell, width: "24%" }}>
                    Tracking No.
                  </Column>
                  <Column style={{ ...tableHeaderCell, width: "20%" }}>
                    Status
                  </Column>
                  <Column style={{ ...tableHeaderCell, width: "20%" }}>
                    Last Updated
                  </Column>
                </Row>
                {visiblePackages.map((pkg, index) => {
                  const pkgBadgeStyle = getStatusBadgeStyle(pkg.statusCode);
                  return (
                    <Row
                      key={pkg.trackingNumber || index}
                      style={index % 2 === 0 ? tableRowEven : tableRowOdd}
                    >
                      <Column style={{ ...tableCell, width: "6%" }}>
                        <Text style={tableCellText}>{pkg.index}</Text>
                      </Column>
                      <Column style={{ ...tableCell, width: "30%" }}>
                        <Text style={tableCellTextBold}>
                          {pkg.description || "Package"}
                        </Text>
                        <Text style={tableCellMuted}>
                          {pkg.packagingType || "Package"}
                          {pkg.quantity ? ` · ${pkg.quantity} qty` : ""}
                        </Text>
                      </Column>
                      <Column style={{ ...tableCell, width: "24%" }}>
                        <Text style={tableMono}>{pkg.trackingNumber}</Text>
                      </Column>
                      <Column style={{ ...tableCell, width: "20%" }}>
                        <Text
                          style={{
                            ...badgeBase,
                            backgroundColor: pkgBadgeStyle.backgroundColor,
                            color: pkgBadgeStyle.color,
                          }}
                        >
                          {pkg.statusLabel}
                        </Text>
                      </Column>
                      <Column style={{ ...tableCell, width: "20%" }}>
                        <Text style={tableCellMuted}>{pkg.lastUpdated}</Text>
                      </Column>
                    </Row>
                  );
                })}
              </Section>
              <Text style={tableFootnote}>
                Showing 1 to {Math.min(totalPackageRows, PACKAGES_PER_PAGE)} of{" "}
                {totalPackageRows} packages. Each item above represents one
                package.
              </Text>
              {hasMorePackages ? (
                <Link href={trackingUrl} style={viewAllPackagesLink}>
                  View all {totalPackageRows} packages on the tracking portal →
                </Link>
              ) : null}
            </Section>
          ) : null}

          {/* Track shipment CTA */}
          <Section style={contentSection}>
            <Section style={softCard}>
              <Row>
                <Column style={{ width: "52px", verticalAlign: "top" }}>
                  <Section style={iconCircle}>
                    <Img
                      src={icons.mobile}
                      width="20"
                      height="20"
                      alt=""
                      style={iconImage}
                    />
                  </Section>
                </Column>
                <Column
                  style={{
                    width: "52%",
                    verticalAlign: "top",
                    paddingLeft: "12px",
                    paddingRight: "12px",
                  }}
                >
                  <Text style={blockTitle}>Track your shipment anytime</Text>
                  <Text style={blockBody}>
                    Track the entire shipment using your Shipment Tracking
                    Number, or track an individual package using its Package
                    Tracking Number.
                  </Text>
                </Column>
                <Column
                  style={{
                    width: "34%",
                    verticalAlign: "middle",
                    textAlign: "center",
                  }}
                >
                  <Button href={trackingUrl} style={ctaButton}>
                    Track Shipment &gt;
                  </Button>
                  <Text style={buttonHelper}>
                    Opens the Atlas Tracking Portal
                  </Text>
                </Column>
              </Row>
            </Section>
          </Section>

          {/* Thank you + support */}
          <Section style={contentSection}>
            <Section style={whiteCard}>
              <Row>
                <Column
                  style={{
                    width: "50%",
                    verticalAlign: "top",
                    paddingRight: "16px",
                  }}
                >
                  <Row>
                    <Column style={{ width: "52px", verticalAlign: "top" }}>
                      <Section style={iconCircle}>
                        <Img
                          src={icons.envelopeSm}
                          width="20"
                          height="20"
                          alt=""
                          style={iconImage}
                        />
                      </Section>
                    </Column>
                    <Column style={{ verticalAlign: "top", paddingLeft: "4px" }}>
                      <Text style={blockBody}>
                        Thank you for choosing Atlas Transportation.
                      </Text>
                      <Text style={blockBodyMuted}>
                        We appreciate your trust in us.
                      </Text>
                      <Text style={signature}>— Atlas Team</Text>
                    </Column>
                  </Row>
                </Column>
                <Column
                  style={{
                    width: "50%",
                    verticalAlign: "top",
                    borderLeft: `1px solid ${colors.slate200}`,
                    paddingLeft: "20px",
                  }}
                >
                  <Row>
                    <Column style={{ width: "52px", verticalAlign: "top" }}>
                      <Section style={iconCircle}>
                        <Img
                          src={icons.headset}
                          width="20"
                          height="20"
                          alt=""
                          style={iconImage}
                        />
                      </Section>
                    </Column>
                    <Column style={{ verticalAlign: "top", paddingLeft: "4px" }}>
                      <Text style={blockTitle}>Need Help?</Text>
                      <Text style={blockBodyMuted}>
                        Contact our customer service team.
                      </Text>
                      <Text style={contactRow}>
                        <Link
                          href={`mailto:${supportEmail}`}
                          style={contactLink}
                        >
                          <Img
                            src={icons.envelope}
                            width="14"
                            height="14"
                            alt=""
                            style={contactIcon}
                          />{" "}
                          {supportEmail}
                        </Link>
                      </Text>
                    </Column>
                  </Row>
                </Column>
              </Row>
            </Section>
          </Section>

          {/* Important reminder */}
          <Section style={contentSection}>
            <Section style={softCard}>
              <Row>
                <Column style={{ width: "52px", verticalAlign: "top" }}>
                  <Section style={iconCircle}>
                    <Img
                      src={icons.shield}
                      width="20"
                      height="20"
                      alt=""
                      style={iconImage}
                    />
                  </Section>
                </Column>
                <Column style={{ verticalAlign: "top", paddingLeft: "12px" }}>
                  <Text style={blockTitle}>Important Reminder</Text>
                  <Text style={blockBody}>
                    Shipment statuses are updated in real-time. For the most
                    accurate and complete information, please visit the Atlas
                    Tracking Portal.
                  </Text>
                  <Text style={blockBody}>
                    <Link href={trackingUrl} style={contactLink}>
                      {trackingUrl}
                    </Link>
                  </Text>
                </Column>
              </Row>
            </Section>
          </Section>

          <Section style={footer}>
            <Text style={footerCompany}>Atlas Transportation Corporation</Text>
            <Text style={footerTagline}>
              Delivering your business. Moving the Philippines.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

export default ShipmentStatusEmail;

const main = {
  backgroundColor: colors.slate100,
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  margin: "0",
  padding: "24px 0",
};

const container = {
  backgroundColor: colors.white,
  border: `1px solid ${colors.slate200}`,
  borderRadius: "12px",
  margin: "0 auto",
  maxWidth: "640px",
  overflow: "hidden",
};

const header = {
  backgroundColor: colors.navyDark,
  padding: "28px 32px",
};

const logo = {
  borderRadius: "10px",
  marginBottom: "0",
};

const contentSection = {
  padding: "0 32px 24px",
};

const greeting = {
  color: colors.slate900,
  fontSize: "18px",
  fontWeight: "600",
  lineHeight: "1.4",
  margin: "24px 0 8px",
};

const intro = {
  color: colors.slate600,
  fontSize: "15px",
  lineHeight: "1.6",
  margin: "0",
};

const statusCard = {
  backgroundColor: colors.slate50,
  border: `1px solid ${colors.slate200}`,
  borderRadius: "12px",
  padding: "20px",
};

const statusBadge = {
  borderRadius: "999px",
  display: "inline-block",
  fontSize: "11px",
  fontWeight: "700",
  letterSpacing: "0.06em",
  lineHeight: "1",
  margin: "0 0 12px",
  padding: "6px 10px",
  textTransform: "uppercase",
};

const badgeBase = {
  borderRadius: "999px",
  display: "inline-block",
  fontSize: "10px",
  fontWeight: "700",
  letterSpacing: "0.04em",
  lineHeight: "1",
  margin: "0",
  padding: "5px 8px",
  textTransform: "uppercase",
};

const shipmentIdText = {
  color: colors.navy,
  fontSize: "22px",
  fontWeight: "700",
  letterSpacing: "0.02em",
  lineHeight: "1.3",
  margin: "0 0 12px",
};

const metaText = {
  color: colors.slate600,
  fontSize: "13px",
  lineHeight: "1.6",
  margin: "0 0 4px",
};

const metaLabel = {
  color: colors.slate700,
  fontWeight: "700",
};

const lastUpdatedBox = {
  backgroundColor: colors.white,
  border: `1px solid ${colors.slate200}`,
  borderRadius: "10px",
  padding: "12px",
};

const lastUpdatedLabel = {
  color: colors.slate500,
  fontSize: "11px",
  fontWeight: "700",
  letterSpacing: "0.06em",
  margin: "0 0 6px",
  textTransform: "uppercase",
};

const lastUpdatedValue = {
  color: colors.slate900,
  fontSize: "12px",
  fontWeight: "600",
  lineHeight: "1.5",
  margin: "0",
};

const summaryCard = {
  backgroundColor: colors.white,
  border: `1px solid ${colors.slate200}`,
  borderRadius: "12px",
  overflow: "hidden",
};

const summaryMainColumn = {
  width: "40%",
  verticalAlign: "middle",
  padding: "20px 18px",
};

const summaryStatColumn = {
  width: "20%",
  verticalAlign: "middle",
  borderLeft: `1px solid ${colors.slate200}`,
  padding: "18px 10px",
  textAlign: "center",
};

const summaryStatHeaderRow = {
  width: "auto",
  margin: "0 auto",
};

const summaryStatIconCol = {
  width: "20px",
  verticalAlign: "middle",
};

const summaryStatLabelCol = {
  verticalAlign: "middle",
  paddingLeft: "4px",
};

const summaryStatIcon = {
  display: "block",
  margin: "0",
};

const summaryStatHeaderLabel = {
  color: colors.navy,
  fontSize: "11px",
  fontWeight: "600",
  lineHeight: "1.3",
  margin: "0",
  whiteSpace: "nowrap",
};

const summaryStatNumber = {
  fontSize: "28px",
  fontWeight: "700",
  lineHeight: "1.1",
  margin: "10px 0 2px",
  textAlign: "center",
};

const summaryStatUnit = {
  color: colors.slate500,
  fontSize: "11px",
  fontWeight: "500",
  lineHeight: "1.3",
  margin: "0",
  textAlign: "center",
};

const sectionEyebrow = {
  color: colors.navy,
  fontSize: "11px",
  fontWeight: "700",
  letterSpacing: "0.08em",
  margin: "0 0 10px",
  textTransform: "uppercase",
};

const summaryHeadlineStyle = {
  color: colors.navy,
  fontSize: "18px",
  fontWeight: "700",
  lineHeight: "1.35",
  margin: "0 0 8px",
};

const summaryHighlight = {
  color: colors.green600,
  fontSize: "28px",
  fontWeight: "700",
};

const summaryHeadlineSuffix = {
  color: colors.navy,
  fontSize: "18px",
  fontWeight: "700",
};

const summarySubtextStyle = {
  color: colors.slate600,
  fontSize: "13px",
  lineHeight: "1.6",
  margin: "0",
};

const summaryLink = {
  color: colors.navy,
  fontSize: "13px",
  textDecoration: "underline",
};

const sectionTitle = {
  color: colors.navy,
  fontSize: "12px",
  fontWeight: "700",
  letterSpacing: "0.08em",
  margin: "0 0 12px",
  textTransform: "uppercase",
};

const tableWrapper = {
  border: `1px solid ${colors.slate200}`,
  borderRadius: "10px",
  overflow: "hidden",
};

const tableHeaderRow = {
  backgroundColor: colors.navy,
};

const tableHeaderCell = {
  color: colors.white,
  fontSize: "10px",
  fontWeight: "700",
  letterSpacing: "0.04em",
  padding: "10px 8px",
  textTransform: "uppercase",
};

const tableRowEven = {
  backgroundColor: colors.white,
};

const tableRowOdd = {
  backgroundColor: colors.slate50,
};

const tableCell = {
  padding: "8px",
  verticalAlign: "top",
};

const tableCellText = {
  color: colors.slate700,
  fontSize: "12px",
  lineHeight: "1.4",
  margin: "0",
};

const tableCellTextBold = {
  color: colors.slate900,
  fontSize: "12px",
  fontWeight: "600",
  lineHeight: "1.4",
  margin: "0 0 2px",
};

const tableCellMuted = {
  color: colors.slate500,
  fontSize: "11px",
  lineHeight: "1.4",
  margin: "0",
};

const tableMono = {
  color: colors.slate700,
  fontFamily: "monospace",
  fontSize: "10px",
  lineHeight: "1.4",
  margin: "0",
  wordBreak: "break-all",
};

const tableFootnote = {
  color: colors.slate500,
  fontSize: "11px",
  lineHeight: "1.5",
  margin: "8px 0 0",
};

const viewAllPackagesLink = {
  color: colors.blue600,
  display: "block",
  fontSize: "12px",
  fontWeight: "600",
  margin: "6px 0 0",
  textDecoration: "underline",
};

const softCard = {
  backgroundColor: "#f4f8fc",
  border: `1px solid ${colors.slate200}`,
  borderRadius: "14px",
  padding: "20px 22px",
};

const whiteCard = {
  backgroundColor: colors.white,
  border: `1px solid ${colors.slate200}`,
  borderRadius: "14px",
  padding: "22px 24px",
};

const iconCircle = {
  backgroundColor: "#dbeafe",
  borderRadius: "22px",
  fontSize: "0",
  lineHeight: "0",
  padding: "12px 0",
  textAlign: "center",
  width: "44px",
};

const iconImage = {
  display: "block",
  margin: "0 auto",
};

const blockTitle = {
  color: colors.navy,
  fontSize: "15px",
  fontWeight: "700",
  lineHeight: "1.4",
  margin: "0 0 6px",
};

const blockBody = {
  color: colors.slate600,
  fontSize: "13px",
  lineHeight: "1.65",
  margin: "0 0 8px",
};

const blockBodyMuted = {
  color: colors.slate500,
  fontSize: "13px",
  lineHeight: "1.65",
  margin: "0 0 8px",
};

const signature = {
  color: colors.blue600,
  fontSize: "13px",
  fontWeight: "700",
  lineHeight: "1.5",
  margin: "4px 0 0",
};

const ctaButton = {
  backgroundColor: colors.blue600,
  borderRadius: "10px",
  color: colors.white,
  display: "inline-block",
  fontSize: "14px",
  fontWeight: "700",
  margin: "0 auto",
  padding: "12px 22px",
  textDecoration: "none",
};

const buttonHelper = {
  color: colors.slate500,
  fontSize: "11px",
  lineHeight: "1.5",
  margin: "8px 0 0",
  textAlign: "center",
};

const contactRow = {
  lineHeight: "1.6",
  margin: "0 0 4px",
};

const contactLink = {
  color: colors.blue600,
  fontSize: "13px",
  fontWeight: "600",
  textDecoration: "underline",
};

const contactIcon = {
  display: "inline-block",
  marginBottom: "-2px",
  verticalAlign: "middle",
};

const footer = {
  backgroundColor: colors.navyDark,
  padding: "20px 32px",
  textAlign: "center",
};

const footerCompany = {
  color: colors.white,
  fontSize: "13px",
  fontWeight: "700",
  margin: "0 0 4px",
};

const footerTagline = {
  color: "#94a3b8",
  fontSize: "12px",
  lineHeight: "1.5",
  margin: "0",
};
