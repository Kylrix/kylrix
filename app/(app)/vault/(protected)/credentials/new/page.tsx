"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Eye,
  EyeOff,
  RefreshCw,
  Plus,
  X,
  Folder,
  Key,
  Loader2,
} from 'lucide-react';
import { useAppwriteVault } from '@/context/appwrite-context';
import {
  createCredential,
  createFolder,
  createTotpSecret,
  listFolders,
} from '@/lib/appwrite';
import type { Folders, Credentials, TotpSecrets } from '@/lib/appwrite/types';
import { generateRandomPassword } from '@/utils/password';
import { masterPassCrypto } from '@/lib/masterpass-crypto';
import toast from 'react-hot-toast';

export default function NewCredentialPage() {
  const router = useRouter();
  const { user } = useAppwriteVault();
  const [showPassword, setShowPassword] = useState(false);
  const [customFields, setCustomFields] = useState<
    Array<{ id: string; label: string; value: string }>
  >([]);
  const [folders, setFolders] = useState<Folders[]>([]);
  const [formData, setFormData] = useState({
    type: "credential" as "credential" | "folder" | "totp",
    name: "",
    url: "",
    username: "",
    password: "",
    notes: "",
    folder: "",
    tags: "",
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user?.$id) {
      listFolders(user.$id)
        .then(setFolders)
        .catch(() => {
          toast.error("Could not load folders.");
        });
    }
  }, [user]);

  const handleGeneratePassword = () => {
    setFormData({ ...formData, password: generateRandomPassword(16) });
  };

  const addCustomField = () => {
    setCustomFields([
      ...customFields,
      { id: Date.now().toString(), label: "", value: "" }]);
  };

  const updateCustomField = (
    id: string,
    field: "label" | "value",
    value: string,
  ) => {
    setCustomFields(
      customFields.map((cf) => (cf.id === id ? { ...cf, [field]: value } : cf)),
    );
  };

  const removeCustomField = (id: string) => {
    setCustomFields(customFields.filter((cf) => cf.id !== id));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (!user?.$id) {
        throw new Error("Not authenticated");
      }

      if (!masterPassCrypto.isVaultUnlocked()) {
        throw new Error("Vault is locked. Please unlock your vault first.");
      }

      if (formData.type === "credential") {
        const credentialData: Pick<
          Credentials,
          | "userId"
          | "itemType"
          | "name"
          | "url"
          | "username"
          | "notes"
          | "folderId"
          | "tags"
          | "customFields"
          | "faviconUrl"
          | "isFavorite"
          | "isDeleted"
          | "createdAt"
          | "updatedAt"
          | "password"
        > = {
          userId: user.$id,
          itemType: "login",
          name: formData.name.trim(),
          url: null,
          username: formData.username.trim(),
          notes: null,
          folderId: null,
          tags: null,
          customFields: null,
          faviconUrl: null,
          isFavorite: false,
          isDeleted: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          password: formData.password.trim(),
        };
        if (formData.url && formData.url.trim())
          credentialData.url = formData.url.trim();
        if (formData.notes && formData.notes.trim())
          credentialData.notes = formData.notes.trim();
        if (formData.folder && formData.folder.trim())
          credentialData.folderId = formData.folder.trim();
        if (formData.tags && formData.tags.trim()) {
          const tagsArr = formData.tags
            .split(",")
            .map((t) => t.trim())
            .filter((t) => t.length > 0);
          if (tagsArr.length > 0) credentialData.tags = tagsArr;
        }
        if (customFields.length > 0)
          credentialData.customFields = JSON.stringify(customFields);

        await createCredential(
          credentialData as Omit<
            Credentials,
            "$id" | "$createdAt" | "$updatedAt"
          >,
        );
        toast.success("Credential created!");
        router.push("/vault/dashboard");
      } else if (formData.type === "folder") {
        await createFolder({
          userId: user.$id,
          name: formData.name,
          parentFolderId: null,
          icon: null,
          color: null,
          sortOrder: 0,
          isDeleted: false,
          deletedAt: null,
        } as unknown as Omit<Folders, "$id" | "$createdAt" | "$updatedAt">);
        toast.success("Folder created!");
        router.push("/vault/dashboard");
      } else if (formData.type === "totp") {
        if (!masterPassCrypto.isVaultUnlocked()) {
          throw new Error("Vault is locked. Please unlock your vault first.");
        }

        await createTotpSecret({
          userId: user.$id,
          issuer: formData.name,
          accountName: formData.username,
          secretKey: formData.password,
          folderId: formData.folder || null,
          algorithm: "SHA1",
          digits: 6,
          period: 30,
          url: null,
          tags: null,
          isFavorite: false,
          isDeleted: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        } as Omit<TotpSecrets, "$id" | "$createdAt" | "$updatedAt">);
        toast.success("TOTP code added!");
        router.push("/totp");
      }
    } catch (e: unknown) {
      const message =
        e instanceof Error
          ? e.message
          : "Failed to save. Please check if your vault is unlocked.";
      toast.error(message);
    }
    setLoading(false);
  };

  if (!user) {
    return (
      <div className="flex justify-center items-center py-20 pointer-events-auto">
        <Loader2 className="w-8 h-8 text-[#6366F1] animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 md:py-10 pointer-events-auto">
      <div className="flex items-center gap-4 mb-8">
        <button
          type="button"
          onClick={() => router.back()}
          className="p-2.5 rounded-full bg-white/5 hover:bg-white/10 text-white transition"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-3xl md:text-4xl font-black font-space-grotesk tracking-tight text-white">
            {formData.type === "credential" ? "Add Credential" : "Add Folder"}
          </h1>
          <p className="text-sm font-medium text-white/50 mt-1">
            {formData.type === "credential"
              ? "Store a new password securely in your vault"
              : "Organize your credentials with folders"}
          </p>
        </div>
      </div>

      <div className="p-6 md:p-8 rounded-[28px] bg-[#0a0a0a]/90 backdrop-blur-2xl border border-white/10">
        <form onSubmit={handleSubmit}>
          <div className="flex flex-col gap-6">
            {/* Type Switcher */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-white/40 uppercase tracking-wider">
                Item Type
              </label>
              <div className="flex gap-2 p-1 bg-white/5 rounded-2xl border border-white/10">
                <button
                  type="button"
                  onClick={() => setFormData(f => ({ ...f, type: "credential" }))}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold transition ${
                    formData.type === "credential"
                      ? "bg-[#6366F1]/10 text-[#6366F1] border border-[#6366F1]"
                      : "text-white/50 border border-transparent hover:text-white"
                  }`}
                >
                  <Key className="w-4.5 h-4.5" />
                  <span>Password</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFormData(f => ({ ...f, type: "folder" }))}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold transition ${
                    formData.type === "folder"
                      ? "bg-[#6366F1]/10 text-[#6366F1] border border-[#6366F1]"
                      : "text-white/50 border border-transparent hover:text-white"
                  }`}
                >
                  <Folder className="w-4.5 h-4.5" />
                  <span>Folder</span>
                </button>
              </div>
            </div>

            {formData.type === "credential" ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-bold text-white/40 uppercase tracking-wider">Name *</label>
                    <input
                      type="text"
                      placeholder="e.g., GitHub, Gmail"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                      className="w-full px-4 py-3 rounded-2xl bg-white/3 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:border-[#6366F1] transition"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-bold text-white/40 uppercase tracking-wider">Website URL</label>
                    <input
                      type="url"
                      placeholder="https://example.com"
                      value={formData.url}
                      onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                      className="w-full px-4 py-3 rounded-2xl bg-white/3 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:border-[#6366F1] transition"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold text-white/40 uppercase tracking-wider">Username/Email *</label>
                  <input
                    type="text"
                    placeholder="john@example.com"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    required
                    className="w-full px-4 py-3 rounded-2xl bg-white/3 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:border-[#6366F1] transition"
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold text-white/40 uppercase tracking-wider">Password *</label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter or generate password"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      required
                      className="w-full pl-4 pr-24 py-3 rounded-2xl bg-white/3 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:border-[#6366F1] transition"
                    />
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="p-1.5 text-white/45 hover:text-white transition"
                      >
                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                      <button
                        type="button"
                        onClick={handleGeneratePassword}
                        className="p-1.5 text-white/45 hover:text-white transition"
                      >
                        <RefreshCw className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-bold text-white/40 uppercase tracking-wider">Folder</label>
                    <select
                      value={formData.folder}
                      onChange={(e) => setFormData({ ...formData, folder: e.target.value })}
                      className="w-full px-4 py-3 rounded-2xl bg-white/3 border border-white/10 text-white focus:outline-none focus:border-[#6366F1] transition [&>option]:bg-[#121212] [&>option]:text-white"
                    >
                      <option value="">No Folder</option>
                      {folders.map((folder) => (
                        <option key={folder.$id} value={folder.$id}>
                          {folder.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-bold text-white/40 uppercase tracking-wider">Tags</label>
                    <input
                      type="text"
                      placeholder="work, email, important"
                      value={formData.tags}
                      onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                      className="w-full px-4 py-3 rounded-2xl bg-white/3 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:border-[#6366F1] transition"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold text-white/40 uppercase tracking-wider">Notes</label>
                  <textarea
                    rows={3}
                    placeholder="Additional notes or information"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    className="w-full px-4 py-3 rounded-2xl bg-white/3 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:border-[#6366F1] transition resize-none"
                  />
                </div>

                {/* Custom Fields */}
                <div className="flex flex-col gap-3">
                  <div className="flex justify-between items-center">
                    <h4 className="text-sm font-extrabold text-white">Custom Fields</h4>
                    <button
                      type="button"
                      onClick={addCustomField}
                      className="flex items-center gap-1 text-sm font-bold text-[#6366F1] hover:text-[#6366F1]/80 transition"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Add Field</span>
                    </button>
                  </div>
                  <div className="flex flex-col gap-3">
                    {customFields.map((field) => (
                      <div key={field.id} className="flex gap-3 items-center">
                        <input
                          type="text"
                          placeholder="Field name"
                          value={field.label}
                          onChange={(e) => updateCustomField(field.id, "label", e.target.value)}
                          className="flex-1 px-3 py-2 rounded-xl bg-white/2 border border-white/10 text-sm text-white placeholder-white/30 focus:outline-none focus:border-[#6366F1] transition"
                        />
                        <input
                          type="text"
                          placeholder="Field value"
                          value={field.value}
                          onChange={(e) => updateCustomField(field.id, "value", e.target.value)}
                          className="flex-1 px-3 py-2 rounded-xl bg-white/2 border border-white/10 text-sm text-white placeholder-white/30 focus:outline-none focus:border-[#6366F1] transition"
                        />
                        <button
                          type="button"
                          onClick={() => removeCustomField(field.id)}
                          className="p-1.5 text-white/30 hover:text-white/60 transition"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-white/40 uppercase tracking-wider">Folder Name *</label>
                <input
                  type="text"
                  placeholder="e.g., Work, Personal"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  className="w-full px-4 py-3 rounded-2xl bg-white/3 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:border-[#6366F1] transition"
                />
              </div>
            )}

            <div className="flex justify-end gap-4 pt-4 border-t border-white/5">
              <button
                type="button"
                onClick={() => router.back()}
                className="px-6 py-3 rounded-2xl font-bold text-white/50 hover:text-white transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex items-center justify-center px-8 py-3 rounded-2xl font-extrabold bg-[#6366F1] text-black hover:bg-[#00D1DA] disabled:bg-white/10 disabled:text-white/30 transition min-w-[160px]"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : formData.type === "credential" ? (
                  "Save Credential"
                ) : (
                  "Save Folder"
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
