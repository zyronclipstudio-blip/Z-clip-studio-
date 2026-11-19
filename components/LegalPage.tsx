import Link from "next/link";
import { ZClipLogo } from "@/components/ZClipLogo";
import { LEGAL_UPDATED, SUPPORT_EMAIL, type LegalSection } from "@/lib/legal";

// One calm reading layout for Terms and Privacy, in the ZClip look.
export function LegalPage({ title, intro, sections, other }: { title: string; intro: string; sections: LegalSection[]; other: { href: string; label: string } }) {
  return (
    <div className="relative min-h-screen bg-[#05060a] text-[#eceff4]">
      <div className="mx-auto w-full max-w-2xl px-5 pb-20 pt-6">
        <header className="mb-8 flex items-center justify-between gap-3">
          <Link href="/" aria-label="ZClip home"><ZClipLogo size={32} variant="horizontal" /></Link>
          <Link href="/" className="inline-flex min-h-11 items-center rounded-full border border-[#242a35] bg-[#11141b] px-4 text-sm text-[#c3cad6]">Back to ZClip</Link>
        </header>
        <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-2 text-sm text-[#8d97a8]">Last updated {LEGAL_UPDATED}</p>
        <p className="mt-5 text-[15px] leading-7 text-[#c3cad6]">{intro}</p>
        <div className="mt-8 space-y-7">
          {sections.map((s) => (
            <section key={s.title}>
              <h2 className="text-[17px] font-semibold text-[#ecd083]">{s.title}</h2>
              <div className="mt-2 space-y-3">
                {s.body.map((p) => (
                  <p key={p.slice(0, 40)} className="text-[15px] leading-7 text-[#c3cad6]">{p}</p>
                ))}
              </div>
            </section>
          ))}
        </div>
        <section className="mt-9 rounded-[16px] border border-[#242a35] bg-[#11141b] p-4">
          <h2 className="text-[15px] font-semibold">Contact</h2>
          <p className="mt-1 text-sm leading-6 text-[#8d97a8]">
            {SUPPORT_EMAIL ? <>Write to <span className="text-[#ecd083]">{SUPPORT_EMAIL}</span>.</> : "Use the support contact shown on our website or in the app."}
          </p>
        </section>
        <p className="mt-8 text-center text-sm text-[#8d97a8]">
          <Link href={other.href} className="text-[#ecd083] underline underline-offset-4">{other.label}</Link>
          <span className="mx-2">·</span>Proudly by Zyron
        </p>
      </div>
    </div>
  );
}
