"use client";

import { useState } from "react";

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
        body: JSON.stringify(pickupForm),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "Unable to submit pickup request.");
      }

      setPickupForm(emptyPickupForm);
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
      className="atlas-section-enter atlas-section-2 rounded-2xl border border-slate-200 bg-white p-5 sm:p-7 lg:p-8"
    >
      <div className="mb-6">
        <p className="text-sm font-extrabold uppercase tracking-widest text-blue-700">
          Pickup Request
        </p>
        <h2 className="mt-2 text-3xl font-black text-slate-950 sm:text-4xl">
          Request a pickup
        </h2>
        <p className="mt-3 max-w-3xl text-base leading-7 text-slate-600">
          Send your contact details, pickup address, delivery address, and
          package notes. Atlas will coordinate the next steps with you.
        </p>
      </div>

      <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4">
        <p className="text-sm font-bold text-amber-800">⚠️ Under Maintenance</p>
        <p className="mt-1 text-sm text-amber-700">
          Our pickup request form is currently under maintenance. We apologize
          for the inconvenience.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="grid gap-4 lg:grid-cols-2">
        <TextInput
          name="fullName"
          label="Full name"
          value={pickupForm.fullName}
          onChange={handleChange}
          disabled={true}
        />
        <TextInput
          name="phone"
          label="Phone number"
          type="tel"
          value={pickupForm.phone}
          onChange={handleChange}
          disabled={true}
        />
        <TextInput
          name="email"
          label="Email address"
          type="email"
          value={pickupForm.email}
          onChange={handleChange}
          disabled={true}
        />
        <TextInput
          name="deliveryAddress"
          label="Delivery address"
          value={pickupForm.deliveryAddress}
          onChange={handleChange}
          disabled={true}
        />
        <TextInput
          name="pickupAddress"
          label="Pickup address"
          value={pickupForm.pickupAddress}
          onChange={handleChange}
          className="lg:col-span-2"
          disabled={true}
        />
        <label className="grid gap-2 lg:col-span-2">
          <span className="text-sm font-extrabold text-slate-700">
            Package details
          </span>
          <textarea
            name="packageDetails"
            value={pickupForm.packageDetails}
            onChange={handleChange}
            rows={5}
            required
            disabled={true}
            className="w-full resize-y rounded-xl border border-slate-300 bg-white px-4 py-3 text-base text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
            placeholder="Describe the item count, size, weight, or special handling notes."
          />
        </label>

        <div className="lg:col-span-2">
          <button
            type="submit"
            disabled={true}
            className="w-full rounded-xl bg-blue-700 px-6 py-4 text-sm font-extrabold text-white transition hover:bg-blue-600 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 sm:w-auto"
          >
            Submit Pickup Request
          </button>

          {submitState.message ? (
            <p
              className={`mt-3 text-sm font-bold ${
                submitState.type === "error" ? "text-red-700" : "text-green-700"
              }`}
            >
              {submitState.message}
            </p>
          ) : null}
        </div>
      </form>
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
  disabled = false,
}) {
  return (
    <label className={`grid gap-2 ${className}`}>
      <span className="text-sm font-extrabold text-slate-700">{label}</span>
      <input
        name={name}
        type={type}
        value={value}
        onChange={onChange}
        required
        disabled={disabled}
        className="h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-base text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
      />
    </label>
  );
}
