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

    return () => observer.disconnect();
  }, []);

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
          {isConnected ? (
            <div className="relative">
              <button
                onClick={() => setShowDropdown(!showDropdown)}
                className="flex items-center gap-2 bg-white/5 border border-white/10 px-4 py-2 rounded-full hover:bg-white/10 transition-all"
              >
                <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                <span className="font-['JetBrains_Mono'] text-[10px] tracking-tighter">
                  {truncateAddress(address!)}
                </span>
              </button>

              {showDropdown && (
                <div className="absolute top-full right-0 mt-2 w-48 bg-[#0C0D14] border border-white/10 rounded-xl p-2 shadow-2xl z-[110]">
                  <div className="px-4 py-2 border-b border-white/5 mb-2">
                    <span className="block text-[10px] text-text-secondary uppercase tracking-widest mb-1">
                      Account
                    </span>
                    <span className="font-['JetBrains_Mono'] text-[10px] text-aura break-all">
                      {truncateAddress(address!)}
                    </span>
                  </div>
                  <button
                    onClick={() => { disconnect(); setShowDropdown(false); }}
                    className="w-full text-left px-4 py-2 text-[10px] uppercase tracking-widest text-red-400 hover:bg-white/5 rounded-lg transition-colors"
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
              className="bg-aura hover:bg-aura-light text-bg-main px-6 py-2 rounded-full text-[11px] font-bold uppercase tracking-widest transition-all"
            >
              {isLoading ? "Connecting..." : "Connect Wallet"}
            </button>
          )}

          {/* Mobile Menu Toggle */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="lg:hidden text-white"
          >
            {isMobileMenuOpen ? (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            ) : (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile Menu Drawer */}
      {isMobileMenuOpen && (
        <div className="absolute top-full left-0 right-0 bg-bg-surface border-b border-border-aura animate-[fadeInDown_0.3s_ease-out] md:hidden">
          <div className="flex flex-col p-6 gap-6">
            {NAV_LINKS.map((link) => (
              <button
                key={link.name}
                onClick={() => scrollTo(link.href.replace("#", ""))}
                className="text-left text-lg font-['Cormorant_Garamond'] tracking-widest text-text-secondary hover:text-aura transition-colors"
              >
                {link.name}
              </button>
            ))}
            {!isConnected && (
              <button 
                onClick={connect} 
                className="bg-aura text-bg-main px-6 py-3 rounded-full text-xs font-bold uppercase tracking-widest transition-all"
              >
                Connect Wallet
              </button>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
