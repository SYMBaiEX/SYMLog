import { Brain, Github, Globe, Linkedin, Twitter } from 'lucide-react';
import Link from 'next/link';
import { GlassCard } from './ui/glass-card';

const footerLinks = {
  platform: [
    { name: 'Documentation', href: '/docs' },
    { name: 'API Reference', href: '/api' },
    { name: 'Research', href: '/research' },
    { name: 'Blog', href: '/blog' },
  ],
  company: [
    { name: 'About', href: '/about' },
    { name: 'Blog', href: '/blog' },
    { name: 'Careers', href: '/careers' },
    { name: 'Contact', href: '/contact' },
  ],
  resources: [
    { name: 'Community', href: '/community' },
    { name: 'Research', href: '/research' },
    { name: 'Help Center', href: '/help' },
    { name: 'System Status', href: '/status' },
  ],
  legal: [
    { name: 'Privacy Policy', href: '/privacy' },
    { name: 'Terms of Service', href: '/terms' },
    { name: 'Security', href: '/security' },
  ],
};

const socialLinks = [
  { name: 'GitHub', href: 'https://github.com', icon: Github },
  { name: 'Twitter', href: 'https://twitter.com', icon: Twitter },
  { name: 'LinkedIn', href: 'https://linkedin.com', icon: Linkedin },
];

export function Footer() {
  return (
    <footer className="relative mt-20">
      <GlassCard className="mx-4 mb-8 rounded-2xl">
        <div className="container mx-auto px-6 py-12">
          <div className="grid grid-cols-1 gap-8 md:grid-cols-5">
            {/* Brand */}
            <div className="md:col-span-1">
              <Link className="group flex items-center space-x-2" href="/">
                <Brain className="h-8 w-8 text-periwinkle group-hover:animate-pulse" />
                <span className="gradient-text from-periwinkle to-light-green font-bold text-2xl">
                  SYMLog
                </span>
              </Link>
              <p className="mt-4 max-w-xs text-muted-foreground text-sm">
                Advanced digital platform with cutting-edge technology and
                secure Web3 integration.
              </p>
              <div className="mt-6 flex space-x-3">
                {socialLinks.map((social) => {
                  const Icon = social.icon;
                  return (
                    <Link
                      className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-periwinkle"
                      href={social.href}
                      key={social.name}
                      rel="noopener noreferrer"
                      target="_blank"
                    >
                      <span className="sr-only">{social.name}</span>
                      <Icon className="h-5 w-5" />
                    </Link>
                  );
                })}
              </div>
            </div>

            {/* Links */}
            <div className="grid grid-cols-2 gap-8 md:col-span-4 md:grid-cols-4">
              <div>
                <h3 className="mb-4 font-semibold text-foreground">Platform</h3>
                <ul className="space-y-3">
                  {footerLinks.platform.map((link) => (
                    <li key={link.name}>
                      <Link
                        className="text-muted-foreground text-sm transition-colors hover:text-periwinkle"
                        href={link.href}
                      >
                        {link.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h3 className="mb-4 font-semibold text-foreground">Company</h3>
                <ul className="space-y-3">
                  {footerLinks.company.map((link) => (
                    <li key={link.name}>
                      <Link
                        className="text-muted-foreground text-sm transition-colors hover:text-light-green"
                        href={link.href}
                      >
                        {link.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h3 className="mb-4 font-semibold text-foreground">
                  Resources
                </h3>
                <ul className="space-y-3">
                  {footerLinks.resources.map((link) => (
                    <li key={link.name}>
                      <Link
                        className="text-muted-foreground text-sm transition-colors hover:text-light-green"
                        href={link.href}
                      >
                        {link.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h3 className="mb-4 font-semibold text-foreground">Legal</h3>
                <ul className="space-y-3">
                  {footerLinks.legal.map((link) => (
                    <li key={link.name}>
                      <Link
                        className="text-muted-foreground text-sm transition-colors hover:text-periwinkle"
                        href={link.href}
                      >
                        {link.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          <div className="mt-12 border-border border-t pt-8">
            <div className="flex flex-col items-center justify-between space-y-4 md:flex-row md:space-y-0">
              <p className="text-muted-foreground text-sm">
                © 2025 SYMLog. All rights reserved. Built with ❤️ for the AI
                community.
              </p>
              <div className="flex items-center space-x-2 text-muted-foreground/70 text-xs">
                <span>Powered by</span>
                <span className="text-periwinkle">Glassmorphism</span>
                <span>&</span>
                <span className="text-light-green">Web3</span>
              </div>
            </div>
          </div>
        </div>
      </GlassCard>
    </footer>
  );
}
