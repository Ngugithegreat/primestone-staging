import { Hero } from "@/components/landing/Hero";
import { SiteBackground } from "@/components/landing/SiteBackground";
import { SiteNav } from "@/components/landing/SiteNav";
import {
  AccountTypesSection,
  CtaBand,
  Faq,
  Features,
  Funding,
  GlobalReach,
  HowItWorks,
  PlatformShowcase,
  SiteFooter,
  StatsBand,
  Testimonials,
  TopTraders,
} from "@/components/landing/Sections";

export default function HomePage() {
  return (
    <>
      <SiteBackground />
      <SiteNav />
      <main>
        <Hero />
        <StatsBand />
        <HowItWorks />
        <TopTraders />
        <Features />
        <PlatformShowcase />
        <GlobalReach />
        <AccountTypesSection />
        <Funding />
        <Testimonials />
        <Faq />
        <CtaBand />
      </main>
      <SiteFooter />
    </>
  );
}
