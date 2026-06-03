"use client";

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Key,
  Shield,
  Clock,
  AlertTriangle,
  Plus,
  Download,
  ChevronRight,
  Loader2,
} from 'lucide-react';
import { useAppwriteVault } from '@/context/appwrite-context';
import {
  appwriteDatabases,
  APPWRITE_DATABASE_ID,
  APPWRITE_COLLECTION_TOTPSECRETS_ID,
  Query,
  AppwriteService,
} from '@/lib/appwrite';
import { masterPassCrypto } from '@/lib/masterpass-crypto';
import { useDataNexus } from '@/context/DataNexusContext';

export default function OverviewPage() {
  const { user } = useAppwriteVault();
  const { fetchOptimized } = useDataNexus();
  const [stats, setStats] = useState({ totalCreds: 0, totpCount: 0 });
  const [recent, setRecent] = useState<
    Array<{ $id: string; name: string; username?: string }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [dupGroups, setDupGroups] = useState<
    Array<{ key: string; count: number; fields: string[]; ids: string[] }>
  >([]);

  const locked = useMemo(() => !masterPassCrypto.isVaultUnlocked(), []);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!user) return;
      try {
        const credsResp = await fetchOptimized(`v_creds_total_${user.$id}`, () =>
          AppwriteService.listCredentials(
            user.$id,
            1,
            0,
            [Query.orderDesc("$updatedAt")],
          )
        );

        let totpCount = 0;
        try {
          const totpResp = await fetchOptimized(`v_totp_total_${user.$id}`, () =>
            appwriteDatabases.listDocuments(
              APPWRITE_DATABASE_ID,
              APPWRITE_COLLECTION_TOTPSECRETS_ID,
              [Query.equal("userId", user.$id), Query.limit(1)],
            )
          );
          totpCount =
            (
              totpResp as {
                total?: number;
                documents: Array<Record<string, unknown>>;
                rows: Array<Record<string, unknown>>;
              }
            ).total ?? totpResp.rows.length;
        } catch {
        }

        const credsTyped = credsResp as {
          total?: number;
          documents?: Array<Record<string, unknown>>;
          rows?: Array<Record<string, unknown>>;
        };
        const totalCreds = credsTyped.total ?? credsTyped.rows?.length ?? 0;

        let dupGroupsLocal: Array<{
          key: string;
          count: number;
          fields: string[];
          ids: string[];
        }> = [];
        try {
          const windowSize = Math.min(50, totalCreds);
          const recentWindow = await fetchOptimized(`v_recent_creds_window_${user.$id}`, () =>
            AppwriteService.listCredentials(
              user.$id,
              windowSize,
              0,
              [Query.orderDesc("$updatedAt")],
            )
          );
          const recentWindowTyped = recentWindow as {
            documents?: any[];
            rows?: any[];
          };
          const items = recentWindowTyped.rows || [];

          const fieldCandidates = [
            "username",
            "password",
            "url",
            "notes",
            "customFields"];
          const fieldsPresent = fieldCandidates.filter((f) =>
            items.some((it) => {
              const val = (it as Record<string, unknown>)[f];
              return val != null && String(val).trim() !== "";
            }),
          );
          const groups = new Map<string, { ids: string[] }>();

          const normalize = (v: unknown) => {
            if (v == null) return "";
            if (typeof v === "string") return v.trim().toLowerCase();
            try {
              return JSON.stringify(v);
            } catch {
              return String(v);
            }
          };

          for (const it of items) {
            const sigObj: Record<string, unknown> = {};
            for (const f of fieldsPresent)
              sigObj[f] = normalize((it as Record<string, unknown>)[f]);
            const signature = JSON.stringify(sigObj);
            const entry = groups.get(signature) || { ids: [] };
            entry.ids.push(String((it as Record<string, unknown>)["$id"]));
            groups.set(signature, entry);
          }

          dupGroupsLocal = Array.from(groups.entries())
            .filter(([, v]) => v.ids.length > 1)
            .map(([k, v]) => ({
              key: k,
              count: v.ids.length,
              fields: fieldsPresent,
              ids: v.ids,
            }));
        } catch {}

        let recentItems: Array<{
          $id: string;
          name: string;
          username?: string;
        }> = [];
        try {
          const recentDocs = (await AppwriteService.listRecentCredentials(
            user.$id,
            5,
          )) as Array<Record<string, unknown>>;
          recentItems = recentDocs.map((d) => ({
            $id: String(d.$id as unknown as string),
            name: (d.name as string) ?? (d.title as string) ?? "Untitled",
            username: d.username as string | undefined,
          }));
        } catch {
          const credsTyped2 = credsResp as { documents?: any[], rows?: any[] };
          recentItems = (credsTyped2.rows || [])
            .slice(0, 5)
            .map((d) => ({
              $id: String((d as Record<string, unknown>)["$id"]),
              name:
                ((d as Record<string, unknown>)["name"] as string) ??
                 ((d as Record<string, unknown>)["title"] as string) ??
                "Untitled",
              username: (d as Record<string, unknown>)["username"] as
                | string
                | undefined,
            }));
        }

        if (!cancelled) {
          setStats({ totalCreds, totpCount });
          setRecent(locked ? [] : recentItems);
          setDupGroups(locked ? [] : dupGroupsLocal);
          setLoading(false);
        }
      } catch {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [
    user,
    locked,
    fetchOptimized]);

  if (!user) return null;

  return (
    <div className="w-full min-h-screen bg-transparent flex justify-center p-4 md:p-8">
      <div className="w-full max-w-6xl">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl md:text-4xl font-black font-clash tracking-tight text-white mb-1">
              Overview
            </h1>
            <p className="text-sm font-medium text-white/40">
              A quick snapshot of your secure vault.
            </p>
          </div>
          <div className="flex gap-3">
            <Link
              href="/credentials/new"
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-extrabold bg-[#6366F1] text-black hover:bg-[#6366F1]/80 transition text-sm"
            >
              <Plus className="w-4.5 h-4.5" />
              <span>Add Credential</span>
            </Link>
            <Link
              href="/import"
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold border border-white/10 text-white hover:border-white/20 hover:bg-white/5 transition text-sm"
            >
              <Download className="w-4.5 h-4.5" />
              <span>Import</span>
            </Link>
          </div>
        </div>

        {locked && (
          <div className="p-4 mb-6 rounded-2xl bg-[#FFB000]/5 border border-[#FFB000]/20 flex items-center gap-3">
            <AlertTriangle className="w-6 h-6 text-[#FFB000] flex-shrink-0" />
            <p className="text-sm font-semibold text-[#FFB000]">
              Your vault is locked. Unlock to view full statistics and recent activity.
            </p>
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,200px),1fr))] gap-6 mb-8 w-full">
          {[
            { label: 'Total Credentials', value: stats.totalCreds, icon: Key, color: 'text-[#6366F1]', bg: 'bg-[#6366F1]/8', border: 'border-[#6366F1]/15 hover:border-[#6366F1]/35' },
            { label: 'TOTP Codes', value: stats.totpCount, icon: Shield, color: 'text-[#10B981]', bg: 'bg-[#10B981]/8', border: 'border-[#10B981]/15 hover:border-[#10B981]/35' },
            { label: 'Recent Activity', value: Math.min(stats.totalCreds, 5), icon: Clock, color: 'text-[#A855F7]', bg: 'bg-[#A855F7]/8', border: 'border-[#A855F7]/15 hover:border-[#A855F7]/35' },
            { label: 'Security Alerts', value: 0, icon: AlertTriangle, color: 'text-[#F59E0B]', bg: 'bg-[#F59E0B]/8', border: 'border-[#F59E0B]/15 hover:border-[#F59E0B]/35' },
          ].map((stat, i) => (
            <div
              key={i}
              className={`p-6 rounded-[24px] bg-[#161412] border border-[#34322F] flex flex-col justify-between gap-4 transition duration-200 ${stat.border}`}
            >
              <div className="flex flex-col gap-1 min-w-0">
                <span className="text-white/40 font-bold uppercase tracking-widest font-mono text-[10px] leading-tight">
                  {stat.label}
                </span>
                <span className="text-3xl font-black font-clash tracking-tight text-white leading-none">
                  {loading ? <Loader2 className="w-5 h-5 text-white/20 animate-spin" /> : stat.value}
                </span>
              </div>
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${stat.bg} border border-white/5`}>
                <stat.icon className={`w-5 h-5 ${stat.color}`} />
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Recent Items */}
          <div className="lg:col-span-7">
            <div className="p-6 rounded-[28px] bg-[#161412] border border-[#34322F] h-full flex flex-col">
              <h3 className="text-lg font-black font-space-grotesk text-white mb-6">
                Recent Items
              </h3>
              <div className="flex flex-col gap-3 flex-1 justify-start">
                {loading ? (
                  <div className="flex justify-center items-center py-10">
                    <Loader2 className="w-8 h-8 text-[#6366F1] animate-spin" />
                  </div>
                ) : recent.length === 0 ? (
                  <p className="text-sm text-white/30 py-10 text-center">
                    No items found in your vault.
                  </p>
                ) : (
                  recent.map((item) => (
                    <Link
                      key={item.$id}
                      href={`/dashboard?focus=${item.$id}`}
                      className="flex items-center gap-3.5 px-4 py-3 rounded-2xl bg-white/2 border border-transparent hover:bg-white/5 hover:border-white/10 text-white transition min-w-0"
                    >
                      <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-base font-extrabold text-[#6366F1] flex-shrink-0">
                        {item.name?.[0]?.toUpperCase() ?? "?"}
                      </div>
                      <div className="flex-1 min-w-0 flex flex-col">
                        <span className="font-extrabold text-sm text-white truncate leading-tight">{item.name}</span>
                        {item.username && (
                          <span className="text-xs text-white/40 truncate mt-0.5 leading-normal">
                            {item.username}
                          </span>
                        )}
                      </div>
                      <ChevronRight className="w-4.5 h-4.5 text-white/30 flex-shrink-0" />
                    </Link>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Duplicate Items */}
          <div className="lg:col-span-5">
            <div className="p-6 rounded-[28px] bg-[#161412] border border-[#34322F] h-full flex flex-col">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-black font-space-grotesk text-white">
                  Duplicates
                </h3>
                <span className="px-3 py-1 rounded-lg bg-[#6366F1]/10 text-[#6366F1] text-[10px] font-extrabold tracking-wider uppercase">
                  {dupGroups.length} GROUPS
                </span>
              </div>

              <div className="flex flex-col gap-4 flex-1">
                {loading ? (
                  <div className="flex justify-center items-center py-10">
                    <Loader2 className="w-8 h-8 text-[#6366F1] animate-spin" />
                  </div>
                ) : dupGroups.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 gap-3 text-center">
                    <Shield className="w-10 h-10 text-white/10" />
                    <p className="text-sm text-white/30">
                      No duplicates detected.
                    </p>
                  </div>
                ) : (
                  dupGroups.map((g, idx) => (
                    <div key={g.key} className="p-4 rounded-2xl bg-white/2 border border-white/5 flex flex-col gap-3">
                      <div className="flex justify-between items-center">
                        <h4 className="text-sm font-extrabold text-white">
                          Group #{idx + 1}
                        </h4>
                        <span className="text-xs font-bold text-[#6366F1]">
                          {g.count} matches
                        </span>
                      </div>
                      <p className="text-xs text-white/40 leading-normal">
                        Matching: {g.fields.join(", ")}
                      </p>
                      <Link 
                        href={`/dashboard?focus=${g.ids[0]}`}
                        className="w-full py-2 rounded-xl text-xs font-bold border border-white/10 text-white hover:border-[#6366F1] hover:bg-[#6366F1]/5 transition text-center"
                      >
                        Review Group
                      </Link>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
