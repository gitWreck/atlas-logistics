import HeroSection from "./components/home/HeroSection";
import HomeNav from "./components/home/HomeNav";
import PickupSection from "./components/home/PickupSection";
import ScheduleSection from "./components/home/ScheduleSection";
import SupportSection from "./components/home/SupportSection";
import TrackingSection from "./components/home/TrackingSection";
import WarehousesSection from "./components/home/WarehousesSection";
import { GuestChatProvider } from "./components/chat/GuestChatProvider";

export default function Home() {
  return (
    <GuestChatProvider>
      <main className="relative isolate min-h-screen overflow-hidden bg-slate-50 text-slate-950">
      <div
        aria-hidden="true"
        className="fixed inset-0 -z-10 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage:
            "linear-gradient(180deg, rgba(248, 250, 252, 0.92), rgba(248, 250, 252, 0.86) 42%, rgba(248, 250, 252, 0.94)), url('/background.jpg')",
        }}
      />
      <div
        aria-hidden="true"
        className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_18%_8%,rgba(37,99,235,0.12),transparent_30%),radial-gradient(circle_at_86%_16%,rgba(20,184,166,0.10),transparent_26%)]"
      />

      <HomeNav />

      <div className="relative mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
        <HeroSection />
        <TrackingSection />
        <ScheduleSection />
        <WarehousesSection />
        <SupportSection />
        <PickupSection />

        <footer className="pb-4 pt-2 text-center text-sm text-slate-500">
          &copy; 2026 Atlas Transport Corporation. All rights reserved.
        </footer>
      </div>
    </main>
    </GuestChatProvider>
  );
}
