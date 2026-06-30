import type { ReactNode } from "react";

export const metadata = {
  title: "OpenChat",
  description: "Open-source Instagram comment-to-DM automation with a follower gate.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
