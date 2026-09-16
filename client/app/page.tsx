import Link from "next/link";
import { GardenPulse } from "@/components/GardenPulse";
import { Icon } from "@/components/Icon";
import LivingScene from "@/components/LivingScene";
import { MusicMini } from "@/components/Music";

const NAV = [
  { href: "/garden", label: "Garden" },
  { href: "/seeds", label: "Seeds" },
  { href: "/growing", label: "Growing" },
  { href: "/harvest", label: "Harvest" },
  { href: "/gifts", label: "Gifts" },
];

export default function LandingPage() {
  return (
    <div className="landing scene">
      <LivingScene />
      <header className="landing-brand">
        <Icon name="sprout" /> <span>Solace</span>
      </header>
      <nav className="landing-nav">
        {NAV.map((item) => (
          <Link key={item.href} href={item.href}>
            {item.label}
          </Link>
        ))}
      </nav>
      <div className="landing-hero">
        <h1>Solace</h1>
        <p className="lede">Some things need somewhere to go.</p>
        <p className="sub">
          A quiet place to plant your thoughts, tend what matters, and give what you&apos;ve grown.
        </p>
        <GardenPulse />
      </div>
      <div className="home-music">
        <MusicMini />
      </div>
    </div>
  );
}
