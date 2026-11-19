// Legal text for ZClip. Plain data so the same wording is used everywhere.
// Draft for the owner to have reviewed by a Nigerian lawyer before charging money.

export const LEGAL_UPDATED = "19 November 2026";
export const SUPPORT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "";

export interface LegalSection {
  title: string;
  body: string[];
}

export const TERMS: LegalSection[] = [
  {
    title: "1. Who we are",
    body: [
      "ZClip (Zyron Clip Studio) is a video editing service made by Zyron Studio. In these terms, \"we\", \"us\" and \"ZClip\" mean Zyron Studio, and \"you\" means the person using ZClip.",
      "By creating an account or using ZClip you agree to these terms and to our Privacy Policy. If you do not agree, please do not use ZClip.",
    ],
  },
  {
    title: "2. Who can use ZClip",
    body: [
      "You must be at least 18 years old, or the age of majority where you live, to create an account. You are responsible for keeping your password safe and for everything done through your account.",
      "Give us accurate information, and tell us quickly if you think someone else has accessed your account.",
    ],
  },
  {
    title: "3. Your videos and your rights",
    body: [
      "You keep ownership of the clips you upload and of the videos you make. We do not claim your content.",
      "To run the service, you give us a limited permission to store, process, analyse, edit, render and show your content to you. We use it only to provide ZClip to you, to keep the service safe, and to improve how it works. We do not sell your content.",
      "You promise that you own what you upload, or have permission to use it, and that it does not break anyone's rights or the law. You are responsible for what you publish with ZClip.",
    ],
  },
  {
    title: "4. What you must not do",
    body: [
      "Do not upload or create content that is illegal, sexually exploits or endangers children, promotes violence or hate, harasses or threatens people, or is meant to deceive people in harmful ways (for example, fake videos of real people to mislead or hurt them).",
      "Do not infringe other people's copyright, trademarks or privacy. Do not try to break, overload, scrape or reverse engineer ZClip. Do not abuse free credits, for example by making many accounts. Do not resell ZClip without our written permission.",
      "We may block uploads, hold or close accounts, and remove content that breaks these rules or puts others at risk.",
    ],
  },
  {
    title: "5. Automatic editing and AI",
    body: [
      "ZClip uses automated tools, which may include AI from third-party providers, to analyse clips and suggest or make edits. Results can be imperfect. Always watch your video before you publish or share it.",
      "When AI features are used, the parts of your clips needed to do the job may be sent to those providers under their terms. We choose providers carefully and send only what is needed.",
      "We do not promise that any edit will suit your purpose, be free of errors, or be unique.",
    ],
  },
  {
    title: "6. Credits, plans and payments",
    body: [
      "ZClip works with credits. The credit cost of an automatic edit is shown before you approve it. Manual fixes to your own edit do not use extra credits.",
      "If a render fails because of our system, the credits for that attempt are returned to you. Credits have no cash value, cannot be transferred, and are not refundable once used. We may set expiry rules or plan limits, and we will show them before you pay.",
      "Paid plans and top-ups are charged in Naira, or another currency if we offer it, through our payment partner (currently Paystack). We do not see or store your card number. Prices and plans may change; changes do not affect what you have already paid for.",
      "Free accounts may have limits such as fewer credits, shorter videos, lower quality or a watermark. We may change free limits to prevent abuse.",
    ],
  },
  {
    title: "7. Storage and deleting your files",
    body: [
      "Your clips and finished videos are stored privately. We keep them only as long as needed to give you the service, and they may be deleted automatically after a retention period that we will show in the app. Download your finished videos promptly. Do not rely on ZClip as your only copy.",
      "You can delete a project and its files at any time from My Edits. Some records, such as credit and payment history, may be kept for accounting, fraud prevention and legal reasons.",
    ],
  },
  {
    title: "8. Availability and changes",
    body: [
      "ZClip is a new service and may change. We work to keep it running, but it may be unavailable at times, and features may be added, changed or removed. We may limit access or the number of users while we grow.",
    ],
  },
  {
    title: "9. Ending your account",
    body: [
      "You may stop using ZClip at any time. We may suspend or end your account if you break these terms, abuse the service, or if the law requires it. If we end your account without a rule break, we will return unused paid credits where the law requires.",
    ],
  },
  {
    title: "10. Our rights",
    body: [
      "The ZClip name, logo, design, software and effects belong to Zyron Studio or its licensors. You may use them only through ZClip as these terms allow.",
    ],
  },
  {
    title: "11. Limits of our responsibility",
    body: [
      "ZClip is provided \"as is\" and \"as available\". To the fullest extent the law allows, we are not responsible for indirect or consequential losses, lost profits, lost data, or losses from content you publish. Our total responsibility for any claim is limited to the amount you paid us in the three months before the claim.",
      "Nothing in these terms limits rights you have under Nigerian law that cannot be limited.",
    ],
  },
  {
    title: "12. Changes to these terms",
    body: [
      "We may update these terms. If a change matters, we will tell you in the app. If you keep using ZClip after a change, you accept the new terms.",
    ],
  },
  {
    title: "13. Law and contact",
    body: [
      "These terms are governed by the laws of the Federal Republic of Nigeria. We will try to settle any disagreement in good faith first. Courts in Lagos State, Nigeria have jurisdiction, unless the law gives you a different right.",
    ],
  },
];

export const PRIVACY: LegalSection[] = [
  {
    title: "1. What this covers",
    body: [
      "This policy explains what personal data ZClip collects, why, who we share it with, and the choices you have. We handle personal data in line with the Nigeria Data Protection Act 2023 and other laws that apply to us.",
    ],
  },
  {
    title: "2. What we collect",
    body: [
      "Account data: your email address and a password, which is stored in protected form by our sign-in provider. We never see your password in plain text.",
      "Your content: the clips you upload, the videos we make for you, your edit settings, and information worked out from your clips (such as transcripts, scene descriptions and quality scores) so we can edit them.",
      "Usage records: credit use, project history, and safety records such as upload limits and abuse checks.",
      "Technical data: device and browser type, approximate network information, error logs and security logs.",
      "Payment data: when payments are turned on, they are handled by our payment partner. We receive confirmation and basic details, not your card number.",
    ],
  },
  {
    title: "3. Why we use it",
    body: [
      "To run ZClip: sign you in, store your clips, make and show your edits, charge and track credits, and give support.",
      "To keep ZClip safe: prevent abuse, fraud and misuse of free credits, and protect other users.",
      "To improve ZClip: fix errors and make the editing better. We do not use your private clips to advertise to you and we do not sell your data.",
    ],
  },
  {
    title: "4. Who we share it with",
    body: [
      "We use service providers to run ZClip. They process data for us and only as needed: Supabase (sign-in and database), Railway (hosting and video processing), Backblaze (private file storage), an AI provider such as Google when automatic editing features are on, and Paystack for payments.",
      "Some providers store or process data outside Nigeria, for example in the United States. We use providers with security commitments and share only what is needed.",
      "We may share data if the law requires it, or to protect people from serious harm. We do not sell your personal data.",
    ],
  },
  {
    title: "5. How long we keep it",
    body: [
      "Clips and finished videos are kept only as long as needed to provide the service, and may be deleted automatically after the retention period shown in the app. You can delete a project at any time from My Edits.",
      "Credit and payment records may be kept longer for accounting, security and legal reasons. We delete or anonymise data we no longer need.",
    ],
  },
  {
    title: "6. How we protect it",
    body: [
      "Your clips are stored in private storage. Uploads and downloads use short-lived secure links, and access is limited to your account. No system is perfectly secure, so please use a strong password and keep it private.",
    ],
  },
  {
    title: "7. Your rights",
    body: [
      "You can ask to see the personal data we hold about you, correct it, delete it, object to certain uses, or receive a copy. You can also complain to the Nigeria Data Protection Commission.",
      "You can delete your projects yourself in the app. To ask for anything else, including closing your account, contact us using the details below.",
    ],
  },
  {
    title: "8. Cookies and local storage",
    body: [
      "ZClip uses cookies and local storage to keep you signed in, remember small preferences, and make the app work offline as a web app. We do not use advertising cookies.",
    ],
  },
  {
    title: "9. Children",
    body: [
      "ZClip is for adults. We do not knowingly collect data from children. If you think a child has given us data, contact us and we will remove it.",
    ],
  },
  {
    title: "10. Changes and contact",
    body: [
      "We may update this policy and will tell you in the app if a change matters. Questions or requests: use the contact details below.",
    ],
  },
];
