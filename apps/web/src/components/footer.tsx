import Link from "next/link"
import { Brain, Github, Twitter, Linkedin, Bot, Database, Globe } from "lucide-react"
import { GlassCard } from "./ui/glass-card"

const footerLinks = {
  platform: [
    { name: "AI Agents", href: "/agents", icon: Bot },
    { name: "MCP Servers", href: "/mcp", icon: Database },
    { name: "Documentation", href: "/docs" },
    { name: "API Reference", href: "/api" },
  ],
  company: [
    { name: "About", href: "/about" },
    { name: "Blog", href: "/blog" },
    { name: "Careers", href: "/careers" },
    { name: "Contact", href: "/contact" },
  ],
  resources: [
    { name: "Community", href: "/community" },
    { name: "Research", href: "/research" },
    { name: "Help Center", href: "/help" },
    { name: "System Status", href: "/status" },
  ],
  legal: [
    { name: "Privacy Policy", href: "/privacy" },
    { name: "Terms of Service", href: "/terms" },
    { name: "Security", href: "/security" },
  ],
}

const socialLinks = [
  { name: "GitHub", href: "https://github.com", icon: Github },
  { name: "Twitter", href: "https://twitter.com", icon: Twitter },
  { name: "LinkedIn", href: "https://linkedin.com", icon: Linkedin },
]

export function Footer() {
  return (
    <footer className="relative mt-20">
      <GlassCard className="mx-4 mb-8 rounded-2xl">
        <div className="container mx-auto px-6 py-12">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-8">
            {/* Brand */}
            <div className="md:col-span-1">
              <Link href="/" className="flex items-center space-x-2 group">
                <Brain className="h-8 w-8 text-periwinkle group-hover:animate-pulse" />
                <span className="text-2xl font-bold gradient-text from-periwinkle to-light-green">
                  SYMLog
                </span>
              </Link>
              <p className="mt-4 text-sm text-gray-300 max-w-xs">
                Intelligent AI agents with advanced memory systems and MCP integration for the Web3 era.
              </p>
              <div className="flex space-x-3 mt-6">
                {socialLinks.map((social) => {
                  const Icon = social.icon
                  return (
                    <Link
                      key={social.name}
                      href={social.href}
                      className="text-gray-400 hover:text-periwinkle transition-colors p-2 rounded-lg hover:bg-white/5"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <span className="sr-only">{social.name}</span>
                      <Icon className="h-5 w-5" />
                    </Link>
                  )
                })}
              </div>
            </div>

            {/* Links */}
            <div className="md:col-span-4 grid grid-cols-2 md:grid-cols-4 gap-8">
              <div>
                <h3 className="font-semibold mb-4 text-white">Platform</h3>
                <ul className="space-y-3">
                  {footerLinks.platform.map((link) => {
                    const Icon = link.icon
                    return (
                      <li key={link.name}>
                        <Link
                          href={link.href}
                          className="text-sm text-gray-300 hover:text-periwinkle transition-colors flex items-center gap-2"
                        >
                          {Icon && <Icon className="h-4 w-4" />}
                          {link.name}
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              </div>

              <div>
                <h3 className="font-semibold mb-4 text-white">Company</h3>
                <ul className="space-y-3">
                  {footerLinks.company.map((link) => (
                    <li key={link.name}>
                      <Link
                        href={link.href}
                        className="text-sm text-gray-300 hover:text-light-green transition-colors"
                      >
                        {link.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h3 className="font-semibold mb-4 text-white">Resources</h3>
                <ul className="space-y-3">
                  {footerLinks.resources.map((link) => (
                    <li key={link.name}>
                      <Link
                        href={link.href}
                        className="text-sm text-gray-300 hover:text-light-green transition-colors"
                      >
                        {link.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h3 className="font-semibold mb-4 text-white">Legal</h3>
                <ul className="space-y-3">
                  {footerLinks.legal.map((link) => (
                    <li key={link.name}>
                      <Link
                        href={link.href}
                        className="text-sm text-gray-300 hover:text-periwinkle transition-colors"
                      >
                        {link.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          <div className="border-t border-white/10 mt-12 pt-8">
            <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
              <p className="text-sm text-gray-400">
                © 2025 SYMLog. All rights reserved. Built with ❤️ for the AI community.
              </p>
              <div className="flex items-center space-x-2 text-xs text-gray-500">
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
  )
}