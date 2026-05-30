import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { Providers } from "@/components/providers";
import { SearchBox } from "@/components/search-box";
import { ThemeSwitcher } from "@/components/theme-switcher";

export const metadata: Metadata = {
  title: "Algorithm Learn",
  description: "Interactive learning platform for TheAlgorithms/Python."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur">
            <div className="mx-auto flex max-w-[1600px] flex-col gap-3 px-4 py-4 md:flex-row md:items-center md:justify-between">
              <Link href="/" className="text-xl font-bold">
                Algorithm Learn
              </Link>
              <div className="flex flex-col gap-2 md:flex-row md:items-center">
                <SearchBox />
                <ThemeSwitcher />
              </div>
            </div>
          </header>
          <main className="mx-auto max-w-[1600px] px-4 py-8">{children}</main>
          <footer className="border-t border-border px-4 py-6 text-center text-sm text-foreground/70">
            Built with attribution to{" "}
            <a className="underline" href="https://github.com/TheAlgorithms/Python">
              TheAlgorithms/Python
            </a>{" "}
            and its MIT-licensed contributors.
          </footer>
        </Providers>
      </body>
    </html>
  );
}
