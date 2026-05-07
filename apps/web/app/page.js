import HeroSection from "./components/home/HeroSection";
import HomeNav from "./components/home/HomeNav";
import PickupSection from "./components/home/PickupSection";
import ScheduleSection from "./components/home/ScheduleSection";
import SupportSection from "./components/home/SupportSection";
import TrackingSection from "./components/home/TrackingSection";
import WarehousesSection from "./components/home/WarehousesSection";

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <HomeNav />

      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
        <HeroSection />
        <TrackingSection />
        <ScheduleSection />
        <WarehousesSection />
        <PickupSection />
        <SupportSection />

        <footer className="pb-4 pt-2 text-center text-sm text-slate-500">
          &copy; 2026 Atlas Transport Corporation. All rights reserved.
        </footer>
      </div>
    </main>
  );
}
