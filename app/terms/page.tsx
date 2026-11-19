import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";
import { TERMS } from "@/lib/legal";

export const metadata: Metadata = { title: "Terms of Use · ZClip" };

export default function Terms() {
  return (
    <LegalPage
      title="Terms of Use"
      intro="These are the rules for using ZClip. We wrote them in plain language. Please read them, and ask us if anything is unclear."
      sections={TERMS}
      other={{ href: "/privacy", label: "Read our Privacy Policy" }}
    />
  );
}
