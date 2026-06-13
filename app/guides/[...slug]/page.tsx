'use client';

import React from 'react';
import NextLink from 'next/link';
import { ArrowLeft } from 'lucide-react';
import GuidesShell from '@/components/guides/GuidesShell';
import { getGuideArticleBySlug, GUIDE_ARTICLES, GuidesCard } from '@/components/guides/catalog';

export default function GuideSlugPage({ params }: { params: { slug: string[] } }) {
  const normalizedSlug = params.slug?.join('/') || '';
  const article = getGuideArticleBySlug(normalizedSlug);

  return (
    <GuidesShell>
      <div className="mb-8">
        <NextLink 
          href="/guides"
          className="inline-flex items-center gap-2 text-white/50 hover:text-white text-xs font-bold uppercase tracking-wider transition-all"
        >
          <ArrowLeft size={14} /> Back to Guides
        </NextLink>
      </div>

      {article ? (
        <div className="max-w-4xl">
          {article.render()}
        </div>
      ) : (
        <div className="space-y-6 max-w-xl">
          <div>
            <span className="text-[#F59E0B] font-black text-xs tracking-[0.24em] block uppercase">
              GUIDE NOT FOUND
            </span>
            <h1 className="text-3xl md:text-4xl font-black mt-3 tracking-tight text-white">
              Guide Topic Unavailable
            </h1>
            <p className="text-white/70 mt-4 leading-relaxed text-sm md:text-base">
              The walkthrough you are looking for has not been created or may have relocated.
            </p>
          </div>
          <NextLink 
            href="/guides" 
            className="px-6 py-3 bg-[#6366F1] hover:bg-[#6366F1]/90 text-black font-extrabold rounded-[10px] text-sm transition-all text-center inline-block"
          >
            All Guides
          </NextLink>
        </div>
      )}
    </GuidesShell>
  );
}
