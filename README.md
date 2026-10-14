This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## SafePath milestone QA and Android builds

This repository includes a release preflight and quality commands:

```bash
bun install
bun run release:preflight
bun run typecheck
bun run lint
bun run build
```

`release:preflight` checks project metadata, app ID consistency, required Android permissions, the Gradle wrapper, and required environment-variable documentation. It does not replace a full Next.js build, live database/API verification, or physical Android testing.

To build a debug APK on macOS/Linux:

```bash
bun run android:debug:apk
```

The APK is written to `android/app/build/outputs/apk/debug/app-debug.apk`. This project's `capacitor.config.ts` currently loads the hosted SafePath website, so web changes must be deployed to that configured host before they'll appear in the app; native Android changes require a rebuilt APK.

See [MILESTONE-6-RELEASE-VALIDATION.md](./MILESTONE-6-RELEASE-VALIDATION.md) for the final QA matrix, crash-log commands, and release checklist.
