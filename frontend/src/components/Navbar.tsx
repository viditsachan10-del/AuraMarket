"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useWallet } from "@/hooks/useWallet";
import { truncateAddress } from "@/lib/stellar";

const NAV_LINKS = [
  { name: "Gallery", href: "#gallery" },
  { name: "Mint", href: "#mint" },
  { name: "Market", href: "#marketplace" },
  { name: "Portfolio", href: "#portfolio" },
];

export default function Navbar() {
  const { address, isConnected, isLoading, connect, disconnect } = useWallet();
  const [isScrolled, setIsScrolled] = useState(false);
  const [activeSection, setActiveSection] = useState("");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  // Handle scroll effect
  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 80);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Handle intersection observer for active section
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        });
      },
      { threshold: 0.5, rootMargin: "-72px 0px 0px 0px" }
    );

    NAV_LINKS.forEach((link) => {
      const el = document.querySelector(link.href);
      if (el) observer.observe(el);
    });
  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      const offset = 72;
      const bodyRect = document.body.getBoundingClientRect().top;
      const elementRect = el.getBoundingClientRect().top;
      const elementPosition = elementRect - bodyRect;
      const offsetPosition = elementPosition - offset;

      window.scrollTo({
        top: offsetPosition,
        behavior: "smooth",
      });
    }
    setIsMobileMenuOpen(false);
  };

  return (
    <nav 
      className={`fixed top-0 left-0 right-0 h-[72px] z-[100] transition-all duration-300 ${
        isScrolled 
          ? "bg-[#060608]/90 backdrop-blur-2xl border-b border-aura/20 shadow-[0_4px_30px_rgba(232,168,124,0.1)]" 
          : "bg-transparent border-b border-white/5"
      }`}
    >
      <div className="container mx-auto h-full px-4 md:px-6 flex items-center justify-between">
        {/* Left: Brand */}
        <div 
          className="flex items-center gap-2 cursor-pointer group"
          onClick={() => scrollTo("hero")}
        >
          <span className="text-aura text-2xl group-hover:scale-110 transition-transform">✦</span>
          <span className="font-['Cormorant_Garamond'] font-semibold text-lg tracking-[0.15em] uppercase">
            Aura Market
          </span>
        </div>

        {/* Center: Desktop Links */}
        <div className="hidden lg:flex items-center gap-10">
          {[
            { id: "gallery", label: "Gallery" },
            { id: "mint", label: "Mint" },
            { id: "marketplace", label: "Market" },
            { id: "portfolio", label: "Portfolio" },
          ].map((link) => (
            <button
              key={link.id}
              onClick={() => scrollTo(link.id)}
              className={`text-[11px] font-['JetBrains_Mono'] uppercase tracking-widest transition-all duration-300 hover:text-aura ${
                activeSection === link.id ? "text-aura" : "text-text-secondary"
              }`}
            >
              {link.label}
              {activeSection === link.id && (
                <div className="h-[1px] w-full bg-aura mt-1 animate-fadeInLeft" />
              )}
            </button>
          ))}
        </div>

        {/* Right: Wallet & Mobile Toggle */}
        <div className="flex items-center gap-4">
                      Account
                    </span>
                    <span className="font-['JetBrains_Mono'] text-xs text-primary break-all">
                      {address}
                    </span>
                  </div>
                  <button
                    onClick={() => { disconnect(); setShowDropdown(false); }}
                    className="w-full text-left px-4 py-2 text-xs uppercase tracking-widest text-red-400 hover:bg-white/5 rounded-lg transition-colors"
                  >
                    Disconnect
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={connect}
              disabled={isLoading}
              className="btn-aura"
            >
              {isLoading ? "Connecting..." : "Connect Wallet"}
            </button>
          )}

          {/* Mobile Menu Toggle */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="md:hidden text-primary"
          >
            {isMobileMenuOpen ? "✕" : "☰"}
          </button>
        </div>
      </div>

      {/* Mobile Menu Drawer */}
      {isMobileMenuOpen && (
        <div className="absolute top-full left-0 right-0 bg-bg-surface border-b border-border-aura animate-[fadeInDown_0.3s_ease-out] md:hidden">
          <div className="flex flex-col p-6 gap-6">
            {NAV_LINKS.map((link) => (
              <a
                key={link.name}
                href={link.href}
                onClick={(e) => handleLinkClick(e, link.href)}
                className="text-lg font-['Cormorant_Garamond'] tracking-widest text-text-secondary"
              >
                {link.name}
              </a>
            ))}
            {!isConnected && (
              <button onClick={connect} className="btn-aura w-full">
                Connect Wallet
              </button>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
