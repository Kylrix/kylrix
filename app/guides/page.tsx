'use client';

import React, { useState } from 'react';
import NextLink from 'next/link';
import GuidesShell from '@/components/guides/GuidesShell';
import {
  GUIDE_CATEGORIES,
  GUIDE_ARTICLES,
  GuidesCard,
} from '@/components/guides/catalog';
import { Search } from 'lucide-react';

export default function GuidesLandingPage() {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredArticles = GUIDE_ARTICLES.filter(article => {
    const text = [article.title, article.summary, ...article.keywords].join(' ').toLowerCase();
    return text.includes(searchQuery.toLowerCase());
  });

  return (
    <GuidesShell>
      <div className="space-y-12">
        {/* Hero */}
        <div className="space-y-4">
          <span className="text-[#F59E0B] font-black text-xs tracking-[0.3em] block uppercase">
            USER GUIDES
          </span>
          <h1 className="font-black text-4xl md:text-6xl lg:text-7xl text-white tracking-tight leading-none">
            Ecosystem <br /> Walkthroughs.
          </h1>
          <p className="max-w-3xl text-white/60 text-lg md:text-xl leading-relaxed">
            Step-by-step guides covering every user interaction from note taking, secure 2FA set up, profile changes, to navigating topbar apps.
          </p>
        </div>

        {/* Search */}
        <div className="flex flex-col md:flex-row gap-4 items-center max-w-2xl bg-white/[0.03] border border-white/[0.06] rounded-2xl p-2.5">
          <div className="flex items-center gap-3 w-full px-3">
            <Search size={18} className="text-white/40" />
            <input
              type="text"
              placeholder="Search guides (e.g. 2fa, profile, notes)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent border-none outline-none w-full text-white text-sm placeholder-white/40 font-medium"
            />
          </div>
        </div>

        {/* Categories */}
        {searchQuery === '' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {GUIDE_CATEGORIES.map((category) => {
              const Icon = category.icon;
              const count = GUIDE_ARTICLES.filter((article) => article.category === category.id).length;
              return (
                <div 
                  key={category.id} 
                  className="p-6 h-full bg-white/[0.02] border border-white/[0.06] rounded-2xl transition-all hover:bg-white/[0.03]"
                  style={{ borderColor: `${category.accent}20` }}
                >
                  <div className="flex items-center gap-3 mb-4">
                    <div style={{ color: category.accent }}>
                      <Icon size={18} />
                    </div>
                    <span className="font-black text-xs tracking-wider block uppercase" style={{ color: category.accent }}>
                      {category.title}
                    </span>
                  </div>
                  <h3 className="text-xl md:text-2xl font-black mb-2 text-white">
                    {count} guide{count === 1 ? '' : 's'}
                  </h3>
                  <p className="text-white/65 leading-relaxed text-sm">
                    {category.summary}
                  </p>
                </div>
              );
            })}
          </div>
        )}

        {/* Articles List */}
        <div>
          <h2 className="text-2xl font-black mb-6 text-white">
            {searchQuery ? 'Search Results' : 'All Guides'}
          </h2>
          {filteredArticles.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {filteredArticles.map((article) => (
                <NextLink key={article.slug} href={`/guides/${article.slug}`}>
                  <GuidesCard article={article} />
                </NextLink>
              ))}
            </div>
          ) : (
            <p className="text-white/50 text-sm">No guides matching your query were found.</p>
          )}
        </div>
      </div>
    </GuidesShell>
  );
}
