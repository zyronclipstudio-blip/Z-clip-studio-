import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";
import { PRIVACY } from "@/lib/legal";

export const metadata: Metadata = { title: "Privacy Policy · ZClip" };

export default function Privacy() {
  return (
    <LegalPage
      title="Privacy Policy"
      intro="Your videos and details are yours. This page says what we collect, why we need it, and the choices you have."
      sections={PRIVACY}
      other={{ href: "/terms", label: "Read our Terms of Use" }}
    />
  );
}
