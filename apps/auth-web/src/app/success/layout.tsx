import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Authentication Success - SYMLog Auth',
  description:
    'Authentication successful! Your secure authentication code is ready for SYMLog desktop application.',
  robots: 'noindex, nofollow', // Don't index success pages
};

export default function SuccessLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
