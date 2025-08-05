import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Loading - SYMLog Auth',
  description:
    'Processing authentication request for SYMLog desktop application.',
  robots: 'noindex, nofollow', // Don't index loading pages
};

export default function LoadingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
