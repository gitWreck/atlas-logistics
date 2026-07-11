import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowRight,
  faBookOpen,
  faComments,
  faEnvelope,
  faHeadset,
  faPhone,
} from "@fortawesome/free-solid-svg-icons";

const SUPPORT_PHONE = "+639125453219";

const supportCards = [
  {
    label: "Live Chat",
    value: "Message the operations desk",
    icon: faComments,
    tone: "blue",
    href: `https://wa.me/${SUPPORT_PHONE.replace("+", "")}?text=${encodeURIComponent("Hello Atlas Support, I need help with my shipment.")}`,
    external: true,
  },
  {
    label: "Call Support",
    value: "+63 912 545 3219",
    icon: faPhone,
    tone: "emerald",
    href: `tel:${SUPPORT_PHONE}`,
  },
  {
    label: "Email Support",
    value: "support@atlastransport.ph",
    icon: faEnvelope,
    tone: "amber",
    href: "mailto:support@atlastransport.ph",
  },
  {
    label: "Help Center",
    value: "Tracking, schedules, and pickup help",
    icon: faBookOpen,
    tone: "slate",
  },
];

export default function SupportSection() {
  return (
    <section className="atlas-section-enter atlas-section-3 overflow-hidden rounded-[2rem] border border-slate-800 bg-slate-950 text-white shadow-[0_24px_70px_rgba(15,23,42,0.28)]">
      <div className="relative p-5 sm:p-7 lg:p-8">
        <div className="absolute inset-0 bg-slate-950" />
        <div className="relative grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div>
            <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-800 text-blue-200">
              <FontAwesomeIcon icon={faHeadset} className="text-xl" />
            </div>
            <p className="text-sm font-black uppercase tracking-[0.22em] text-blue-200">
              Atlas Support
            </p>
            <h2 className="mt-3 text-3xl font-black leading-tight sm:text-4xl">
              Start shipping with a team that stays reachable.
            </h2>
            <p className="mt-4 max-w-xl text-base leading-8 text-slate-300">
              Get help with tracking, pickup coordination, warehouse release,
              and schedule questions from the Atlas operations team.
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <a
                href="mailto:support@atlastransport.ph"
                className="atlas-button-rise inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-6 py-4 text-sm font-black text-slate-950 transition hover:-translate-y-0.5 hover:bg-blue-50 focus:outline-none focus:ring-4 focus:ring-white/30"
              >
                Contact Support
                <FontAwesomeIcon icon={faArrowRight} className="text-xs" />
              </a>
              <a
                href="#tracking"
                className="atlas-button-rise inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-700 bg-slate-900 px-6 py-4 text-sm font-black text-white transition hover:-translate-y-0.5 hover:bg-slate-800 focus:outline-none focus:ring-4 focus:ring-white/20"
              >
                Start Tracking
              </a>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {supportCards.map((card, index) => (
              <SupportCard key={card.label} card={card} index={index} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function SupportCard({ card, index }) {
  const tones = {
    blue: "bg-blue-50 text-blue-700",
    emerald: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
    slate: "bg-slate-100 text-slate-700",
  };

  const className =
    "atlas-motion-card atlas-stagger rounded-3xl border border-slate-700 bg-slate-900 p-5 shadow-lg shadow-slate-950/20";

  const content = (
    <>
      <span
        className={`mb-5 flex h-11 w-11 items-center justify-center rounded-2xl ${tones[card.tone]}`}
      >
        <FontAwesomeIcon icon={card.icon} />
      </span>
      <p className="text-sm font-black text-white">{card.label}</p>
      <p className="mt-2 break-words text-sm leading-6 text-slate-300">
        {card.value}
      </p>
    </>
  );

  if (!card.href) {
    return (
      <article
        className={className}
        style={{ "--atlas-delay": `${index * 80}ms` }}
      >
        {content}
      </article>
    );
  }

  return (
    <a
      href={card.href}
      target={card.external ? "_blank" : undefined}
      rel={card.external ? "noopener noreferrer" : undefined}
      className={`${className} block transition hover:-translate-y-0.5 hover:border-slate-500 hover:bg-slate-800 focus:outline-none focus:ring-4 focus:ring-white/20`}
      style={{ "--atlas-delay": `${index * 80}ms` }}
    >
      {content}
    </a>
  );
}
