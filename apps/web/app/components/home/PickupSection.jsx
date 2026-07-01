"use client";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowRight,
  faBoxOpen,
  faClipboardCheck,
  faLocationDot,
  faTruckPickup,
} from "@fortawesome/free-solid-svg-icons";
import { useState } from "react";

const pickupSteps = [
  {
    title: "Book a pickup",
    detail: "Share your preferred collection window and shipment route.",
    icon: faClipboardCheck,
  },
  {
    title: "Prepare your shipment",
    detail: "Pack, label, and keep items ready for driver verification.",
    icon: faBoxOpen,
  },
  {
    title: "Driver collects the package",
    detail: "Atlas coordinates pickup and moves the cargo into the hub flow.",
    icon: faTruckPickup,
  },
];

const pickupWindows = ["Morning", "Afternoon", "Next available"];
const checklist = ["Pickup address", "Package count", "Special handling notes"];

const emptyPickupForm = {
  fullName: "",
  phone: "",
  email: "",
  pickupAddress: "",
  deliveryAddress: "",
  packageDetails: "",
};

export default function PickupSection() {
  const [pickupForm, setPickupForm] = useState(emptyPickupForm);
  const [preferredWindow, setPreferredWindow] = useState(pickupWindows[0]);
  const [submitState, setSubmitState] = useState({
    isSubmitting: false,
    message: "",
    type: "",
  });

  const handleChange = (event) => {
    const { name, value } = event.target;
    setPickupForm((previous) => ({ ...previous, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitState({ isSubmitting: true, message: "", type: "" });

    try {
      const response = await fetch("/api/public/pickup-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...pickupForm,
          packageDetails: `Preferred window: ${preferredWindow}\n\n${pickupForm.packageDetails}`,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "Unable to submit pickup request.");
      }

      setPickupForm(emptyPickupForm);
      setPreferredWindow(pickupWindows[0]);
      setSubmitState({
        isSubmitting: false,
        message: "Pickup request submitted. We will contact you shortly.",
        type: "success",
      });
    } catch (error) {
      setSubmitState({
        isSubmitting: false,
        message:
          error?.message ||
          "Something went wrong while submitting the request.",
        type: "error",
      });
    }
  };

  return (
    <section
      id="pickup"
      className="atlas-section-enter atlas-section-2 scroll-mt-24 overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm"
    >
      <div className="grid lg:grid-cols-[0.9fr_1.1fr]">
        <div className="relative bg-slate-950 p-5 text-white sm:p-7 lg:p-8">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(59,130,246,0.22),transparent_30%),linear-gradient(135deg,rgba(15,23,42,1),rgba(30,41,59,1))]" />
          <div className="relative">
            <p className="text-sm font-black uppercase tracking-[0.22em] text-blue-200">
              Pickup Request
            </p>
            <h2 className="mt-3 text-3xl font-black leading-tight sm:text-4xl">
              Schedule pickup in three clear steps.
            </h2>
            <p className="mt-4 text-base leading-8 text-slate-300">
              Request collection, prepare your cargo, and let Atlas coordinate
              the movement into the right warehouse and route schedule.
            </p>

            <div className="mt-7 grid gap-4">
              {pickupSteps.map((step, index) => (
                <PickupStep key={step.title} step={step} index={index} />
              ))}
            </div>
          </div>
        </div>

        <div className="p-5 sm:p-7 lg:p-8">
          <form
            onSubmit={handleSubmit}
            className="atlas-motion-card rounded-[1.75rem] border border-slate-200 bg-slate-50 p-5 sm:p-6"
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-700">
                  Pickup Planner
                </p>
                <h3 className="mt-2 text-2xl font-black text-slate-950">
                  Request a pickup
                </h3>
                <p className="mt-3 max-w-xl text-sm leading-7 text-slate-600">
                  Share your contact details, addresses, and package notes.
                  Atlas will coordinate the next steps with you.
                </p>
              </div>
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-700 shadow-sm">
                <FontAwesomeIcon icon={faTruckPickup} />
              </span>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <TextInput
                name="fullName"
                label="Full name"
                value={pickupForm.fullName}
                onChange={handleChange}
              />
              <TextInput
                name="phone"
                label="Phone number"
                type="tel"
                value={pickupForm.phone}
                onChange={handleChange}
              />
              <TextInput
                name="email"
                label="Email address"
                type="email"
                value={pickupForm.email}
                onChange={handleChange}
                className="md:col-span-2"
              />
              <TextInput
                name="pickupAddress"
                label="Pickup address"
                value={pickupForm.pickupAddress}
                onChange={handleChange}
                className="md:col-span-2"
              />
              <TextInput
                name="deliveryAddress"
                label="Delivery address"
                value={pickupForm.deliveryAddress}
                onChange={handleChange}
                className="md:col-span-2"
              />
            </div>

            <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-bold uppercase tracking-widest text-slate-500">
                Preferred pickup window
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {pickupWindows.map((window) => {
                  const isSelected = preferredWindow === window;

                  return (
                    <button
                      key={window}
                      type="button"
                      onClick={() => setPreferredWindow(window)}
                      className={`rounded-full border px-3 py-1 text-xs font-black transition ${
                        isSelected
                          ? "border-blue-600 bg-blue-600 text-white"
                          : "border-blue-100 bg-blue-50 text-blue-700 hover:border-blue-200"
                      }`}
                    >
                      {window}
                    </button>
                  );
                })}
              </div>
            </div>

            <label className="mt-4 grid gap-2">
              <span className="text-xs font-bold uppercase tracking-widest text-slate-500">
                Package details
              </span>
              <textarea
                name="packageDetails"
                value={pickupForm.packageDetails}
                onChange={handleChange}
                rows={4}
                required
                className="w-full resize-y rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                placeholder="Item count, size, weight, or special handling notes."
              />
            </label>

            <div className="mt-4 grid gap-3">
              {checklist.map((item, index) => (
                <ChecklistItem key={item} item={item} index={index} />
              ))}
            </div>

            <button
              type="submit"
              disabled={submitState.isSubmitting}
              className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-6 py-4 text-sm font-black text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400 sm:w-auto"
            >
              {submitState.isSubmitting ? "Submitting..." : "Request Pickup"}
              <FontAwesomeIcon icon={faArrowRight} className="text-xs" />
            </button>

            {submitState.message ? (
              <p
                className={`mt-3 text-sm font-bold ${
                  submitState.type === "error"
                    ? "text-red-700"
                    : "text-emerald-700"
                }`}
              >
                {submitState.message}
              </p>
            ) : null}
          </form>
        </div>
      </div>
    </section>
  );
}

function TextInput({
  name,
  label,
  value,
  onChange,
  type = "text",
  className = "",
}) {
  return (
    <label className={`grid gap-2 ${className}`}>
      <span className="text-xs font-bold uppercase tracking-widest text-slate-500">
        {label}
      </span>
      <input
        name={name}
        type={type}
        value={value}
        onChange={onChange}
        required
        className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
      />
    </label>
  );
}

function PickupStep({ step, index }) {
  return (
    <div
      className="atlas-stagger flex gap-4 rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur"
      style={{ "--atlas-delay": `${index * 80}ms` }}
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-slate-950">
        <FontAwesomeIcon icon={step.icon} />
      </span>
      <div>
        <p className="text-xs font-black uppercase tracking-widest text-blue-200">
          Step {index + 1}
        </p>
        <h3 className="mt-1 font-black text-white">{step.title}</h3>
        <p className="mt-1 text-sm leading-6 text-slate-300">{step.detail}</p>
      </div>
    </div>
  );
}

function ChecklistItem({ item, index }) {
  return (
    <div
      className="atlas-stagger flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4"
      style={{ "--atlas-delay": `${index * 70}ms` }}
    >
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-50 text-xs text-emerald-700">
        <FontAwesomeIcon icon={faClipboardCheck} />
      </span>
      <span className="text-sm font-black text-slate-950">{item}</span>
    </div>
  );
}
