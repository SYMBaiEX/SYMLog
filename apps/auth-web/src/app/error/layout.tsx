import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Authentication Error - SYMLog Auth',
  description:
    'Authentication error occurred. Get help resolving login issues with SYMLog authentication portal.',
  robots: 'noindex, nofollow', // Don't index error pages
};

export default function ErrorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
