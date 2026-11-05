"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Key, Users, Shield, Globe, Loader2, Trash2, Plus, Eye, EyeOff, Copy, Check } from "lucide-react";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/hooks/use-auth";
import type { MessageKey } from "@/locales/pt-BR";

interface ApiKey { id: string; name: string; lastUsedAt: string | null; expiresAt: string | null; createdAt: string }
interface NewKeyResult extends ApiKey { key: string }
interface Workspace { id: string; name: string; slug: string }
interface Member { id: string; role: string; user: { id: string; name: string; email: string } }

/** Renders a translated string where `<b>x</b>` segments become <strong>. Values are inserted as text, never as HTML. */
function Rich({ text }: { text: string }) {
  const parts = text.split(/(<b>.*?<\/b>)/g);
  return <>{parts.map((p, i) => (p.startsWith("<b>") ? <strong key={i}>{p.slice(3, -4)}</strong> : <span key={i}>{p}</span>))}</>;
}

const ROLE_KEY: Record<string, MessageKey> = { owner: "st.role.owner", admin: "st.role.admin", member: "st.role.member" };

export function SettingsPage() {
  const { t } = useI18n();
  const { user, role, logout } = useAuth();
  const canAdmin = role === "owner" || role === "admin";

  const [workspaceName, setWorkspaceName] = useState("");
  const [workspaceSlug, setWorkspaceSlug] = useState("");
  const [savingWorkspace, setSavingWorkspace] = useState(false);
  const [savedWorkspace, setSavedWorkspace] = useState(false);
  const [workspaceError, setWorkspaceError] = useState("");

  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [keysLoading, setKeysLoading] = useState(true);
  const [newKeyName, setNewKeyName] = useState("");
  const [creating, setCreating] = useState(false);
  const [newKey, setNewKey] = useState<NewKeyResult | null>(null);
  const [copied, setCopied] = useState(false);

  const [openaiKey, setOpenaiKey] = useState("");
  const [openaiModel, setOpenaiModel] = useState("gpt-4o-mini");
  const [openaiBase, setOpenaiBase] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [savingIntegration, setSavingIntegration] = useState(false);
  const [savedIntegration, setSavedIntegration] = useState(false);

  const [members, setMembers] = useState<Member[]>([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);

  const [keyPendingDelete, setKeyPendingDelete] = useState<ApiKey | null>(null);
  const [confirmDeleteWorkspace, setConfirmDeleteWorkspace] = useState(false);
  const [confirmSlug, setConfirmSlug] = useState("");
  const [deletingWorkspace, setDeletingWorkspace] = useState(false);

  const fail = (e: unknown) => toast.error(e instanceof Error ? e.message : t("common.error"));

  const loadApiKeys = useCallback(async () => {
    try {
      setApiKeys(await api.get<ApiKey[]>("/settings/api-keys"));
    } catch (e) {
      console.error("Failed to load API keys:", e);
    } finally {
      setKeysLoading(false);
    }
  }, []);
  const loadMembers = useCallback(async () => {
    try {
      setMembers(await api.get<Member[]>("/workspace/members"));
    } catch (e) {
      console.error("Failed to load members:", e);
    }
  }, []);

  useEffect(() => { void loadApiKeys(); void loadMembers(); }, [loadApiKeys, loadMembers]);

  useEffect(() => {
    api.get<Workspace>("/workspace")
      .then((w) => { setWorkspaceName(w.name); setWorkspaceSlug(w.slug); })
      .catch((e) => console.error("workspace", e));
  }, []);

  // The API returns the AI key masked ("••••abcd"); sending the mask back keeps the stored key.
  useEffect(() => {
    api.get<Array<{ type: string; config: Record<string, string> }>>("/settings/integrations")
      .then((integrations) => {
        const openai = integrations.find((i) => i.type === "openai");
        if (openai) {
          setOpenaiKey(openai.config.apiKey ?? "");
          setOpenaiModel(openai.config.model || "gpt-4o-mini");
          setOpenaiBase(openai.config.baseURL ?? "");
        }
      })
      .catch((e) => console.error("integrations", e));
  }, []);

  const saveWorkspace = async () => {
    setSavingWorkspace(true);
    setWorkspaceError("");
    try {
      const updated = await api.patch<Workspace>("/workspace", { name: workspaceName, slug: workspaceSlug });
      setWorkspaceName(updated.name);
      setWorkspaceSlug(updated.slug);
      setSavedWorkspace(true);
      setTimeout(() => setSavedWorkspace(false), 2000);
    } catch (e) {
      setWorkspaceError(e instanceof Error ? e.message : t("st.saveFailed"));
    } finally {
      setSavingWorkspace(false);
    }
  };

  const createApiKey = async () => {
    if (!newKeyName.trim()) return;
    setCreating(true);
    try {
      setNewKey(await api.post<NewKeyResult>("/settings/api-keys", { name: newKeyName }));
      setNewKeyName("");
      await loadApiKeys();
    } catch (e) {
      fail(e);
    } finally {
      setCreating(false);
    }
  };

  const deleteApiKey = async (id: string) => {
    try {
      await api.delete(`/settings/api-keys/${id}`);
      setApiKeys((prev) => prev.filter((k) => k.id !== id));
    } catch (e) {
      fail(e);
    } finally {
      setKeyPendingDelete(null);
    }
  };

  const copyKey = async (key: string) => {
    await navigator.clipboard.writeText(key);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const saveAiIntegration = async () => {
    setSavingIntegration(true);
    try {
      await api.post("/settings/integrations", {
        type: "openai",
        name: "OpenAI / Compatible API",
        config: { apiKey: openaiKey, model: openaiModel, baseURL: openaiBase },
      });
      setSavedIntegration(true);
      setTimeout(() => setSavedIntegration(false), 2000);
    } catch (e) {
      fail(e);
    } finally {
      setSavingIntegration(false);
    }
  };

  const invite = async () => {
    if (!inviteEmail.trim()) return;
    setInviting(true);
    try {
      await api.post("/workspace/members", { email: inviteEmail.trim() });
      setInviteEmail("");
      toast.success(t("st.invited"));
      await loadMembers();
    } catch (e) {
      fail(e);
    } finally {
      setInviting(false);
    }
  };
  const changeRole = async (m: Member, next: string) => {
    try {
      await api.patch(`/workspace/members/${m.id}`, { role: next });
      await loadMembers();
    } catch (e) {
      fail(e);
    }
  };
  const removeMember = async (m: Member) => {
    if (!window.confirm(t("st.removeMemberConfirm", { name: m.user.name }))) return;
    try {
      await api.delete(`/workspace/members/${m.id}`);
      toast.success(t("st.memberRemoved"));
      await loadMembers();
    } catch (e) {
      fail(e);
    }
  };

  const deleteWorkspace = async () => {
    setDeletingWorkspace(true);
    try {
      await api.delete("/workspace", { confirmSlug });
      toast.success(t("st.wsDeleted"));
      await logout();
    } catch (e) {
      fail(e);
      setDeletingWorkspace(false);
    }
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("settings.title")}</h1>
        <p className="text-muted-foreground">{t("settings.subtitle")}</p>
        {!canAdmin && <p className="mt-1 text-xs text-muted-foreground">{t("st.readOnly")}</p>}
      </div>

      <Tabs defaultValue="workspace">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="workspace">{t("st.tabWorkspace")}</TabsTrigger>
          <TabsTrigger value="ai">{t("st.tabAi")}</TabsTrigger>
          <TabsTrigger value="team">{t("st.tabTeam")}</TabsTrigger>
          <TabsTrigger value="danger" className="text-destructive data-[state=active]:text-destructive">{t("st.tabDanger")}</TabsTrigger>
        </TabsList>

        <TabsContent value="workspace" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-muted-foreground" />
                <CardTitle className="text-base">{t("st.wsTitle")}</CardTitle>
              </div>
              <CardDescription>{t("st.wsDesc")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {workspaceError && <div className="text-sm text-destructive" role="alert">{workspaceError}</div>}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="ws-name">{t("st.wsName")}</Label>
                  <Input id="ws-name" value={workspaceName} onChange={(e) => setWorkspaceName(e.target.value)} disabled={!canAdmin} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ws-slug">{t("st.slug")}</Label>
                  <Input id="ws-slug" value={workspaceSlug} onChange={(e) => setWorkspaceSlug(e.target.value)} disabled={!canAdmin} />
                </div>
              </div>
              <Button variant="gradient" onClick={saveWorkspace} disabled={savingWorkspace || !canAdmin}>
                {savingWorkspace && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {savedWorkspace ? t("st.saved") : t("st.saveChanges")}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ai" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Key className="w-4 h-4 text-muted-foreground" />
                <CardTitle className="text-base">{t("st.aiTitle")}</CardTitle>
              </div>
              <CardDescription>{t("st.aiDesc")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="ai-key">{t("st.aiKey")}</Label>
                <div className="flex gap-2">
                  <Input
                    id="ai-key"
                    type={showKey ? "text" : "password"}
                    autoComplete="off"
                    placeholder={t("st.aiKeyPh")}
                    value={openaiKey}
                    onChange={(e) => setOpenaiKey(e.target.value)}
                    className="flex-1"
                    disabled={!canAdmin}
                  />
                  <Button variant="outline" size="icon" aria-label={showKey ? t("st.hide") : t("st.show")} onClick={() => setShowKey((s) => !s)} className="flex-shrink-0">
                    {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">{t("st.aiKeyHint")}</p>
              </div>
              <Separator />
              <div className="space-y-2">
                <Label htmlFor="ai-model">{t("st.aiModel")}</Label>
                <Input id="ai-model" placeholder={t("st.aiModelPh")} value={openaiModel} onChange={(e) => setOpenaiModel(e.target.value)} disabled={!canAdmin} />
              </div>
              <Separator />
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="ai-base">{t("st.aiBase")}</Label>
                  <Badge variant="secondary" className="text-xs">{t("st.aiBaseBadge")}</Badge>
                </div>
                <Input id="ai-base" placeholder={t("st.aiBasePh")} value={openaiBase} onChange={(e) => setOpenaiBase(e.target.value)} disabled={!canAdmin} />
              </div>
              <Button variant="gradient" onClick={saveAiIntegration} disabled={savingIntegration || !canAdmin}>
                {savingIntegration ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : savedIntegration ? <Check className="mr-2 h-4 w-4" /> : null}
                {savedIntegration ? t("st.saved") : t("st.saveAi")}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Key className="w-4 h-4 text-muted-foreground" />
                <CardTitle className="text-base">{t("st.keysTitle")}</CardTitle>
              </div>
              <CardDescription>{t("st.keysDesc")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {newKey && (
                <div className="bg-success/10 border border-success/30 rounded-lg p-3 space-y-2">
                  <p className="text-sm font-medium text-success">{t("st.keyCreated")}</p>
                  <div className="flex gap-2">
                    <Input value={newKey.key} readOnly aria-label="API key" className="font-mono text-xs" />
                    <Button variant="outline" size="icon" aria-label={t("common.copy")} onClick={() => copyKey(newKey.key)}>
                      {copied ? <Check className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
                    </Button>
                  </div>
                  <Button variant="ghost" size="sm" className="text-xs" onClick={() => setNewKey(null)}>{t("st.dismiss")}</Button>
                </div>
              )}

              <div className="flex gap-2">
                <Input
                  placeholder={t("st.keyNamePh")}
                  aria-label={t("st.keyNamePh")}
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && createApiKey()}
                  disabled={!canAdmin}
                />
                <Button onClick={createApiKey} disabled={creating || !newKeyName.trim() || !canAdmin} className="flex-shrink-0" aria-label={t("st.createKey")}>
                  {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                </Button>
              </div>

              {keysLoading ? (
                <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
              ) : apiKeys.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">{t("st.noKeys")}</p>
              ) : (
                <div className="space-y-2">
                  {apiKeys.map((key) => (
                    <div key={key.id} data-testid="key-row" className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="text-sm font-medium">{key.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {t("st.created", { date: formatDate(key.createdAt) })}
                          {key.lastUsedAt && ` · ${t("st.lastUsed", { date: formatDate(key.lastUsedAt) })}`}
                        </p>
                      </div>
                      <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive" onClick={() => setKeyPendingDelete(key)} aria-label={t("st.deleteKey")} disabled={!canAdmin}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="team">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-muted-foreground" />
                <CardTitle className="text-base">{t("st.teamTitle")}</CardTitle>
              </div>
              <CardDescription>{t("st.teamDesc")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {members.map((m) => {
                const isSelf = m.user.id === user?.id;
                const editable = canAdmin && m.role !== "owner" && !isSelf;
                return (
                  <div key={m.id} data-testid="member-row" className="flex items-center gap-3 p-3 border rounded-lg">
                    <div className="w-8 h-8 bg-gradient-brand rounded-full flex items-center justify-center text-white text-sm font-bold">{m.user.name.charAt(0).toUpperCase()}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{m.user.name} {isSelf && <span className="text-xs text-muted-foreground">({t("st.you")})</span>}</p>
                      <p className="text-xs text-muted-foreground truncate">{m.user.email}</p>
                    </div>
                    {editable ? (
                      <Select value={m.role} onValueChange={(v) => void changeRole(m, v)}>
                        <SelectTrigger className="h-8 w-28 text-xs" aria-label={t("st.roleFor", { name: m.user.name })}><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">{t("st.role.admin")}</SelectItem>
                          <SelectItem value="member">{t("st.role.member")}</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <Badge>{ROLE_KEY[m.role] ? t(ROLE_KEY[m.role]) : m.role}</Badge>
                    )}
                    {editable && (
                      <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive" aria-label={t("st.removeMember", { name: m.user.name })} onClick={() => void removeMember(m)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                );
              })}
              {canAdmin && (
                <div className="pt-2 space-y-1">
                  <div className="flex gap-2">
                    <Input type="email" placeholder={t("st.invitePh")} aria-label={t("st.invitePh")} value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} onKeyDown={(e) => e.key === "Enter" && invite()} />
                    <Button variant="outline" onClick={invite} disabled={inviting || !inviteEmail.trim()}>
                      {inviting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Users className="mr-2 h-4 w-4" />}{t("st.invite")}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">{t("st.inviteHint")}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="danger">
          <Card className="border-destructive/30">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-destructive" />
                <CardTitle className="text-base text-destructive">{t("st.dangerTitle")}</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium">{t("st.deleteWs")}</p>
                  <p className="text-xs text-muted-foreground">{t("st.deleteWsDesc")}</p>
                </div>
                <Button variant="destructive" size="sm" disabled={role !== "owner"} onClick={() => { setConfirmSlug(""); setConfirmDeleteWorkspace(true); }} data-testid="delete-workspace">
                  {t("st.deleteWs")}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={!!keyPendingDelete} onOpenChange={(open) => !open && setKeyPendingDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("st.deleteKeyTitle")}</DialogTitle>
            <DialogDescription>{keyPendingDelete && <Rich text={t("st.deleteKeyBody", { name: keyPendingDelete.name })} />}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setKeyPendingDelete(null)}>{t("common.cancel")}</Button>
            <Button variant="destructive" onClick={() => keyPendingDelete && deleteApiKey(keyPendingDelete.id)}>{t("st.deleteKeyBtn")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmDeleteWorkspace} onOpenChange={setConfirmDeleteWorkspace}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("st.deleteWsTitle")}</DialogTitle>
            <DialogDescription><Rich text={t("st.deleteWsBody", { name: workspaceName, slug: workspaceSlug })} /></DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="confirm-slug">{t("st.deleteWsConfirmLabel")}</Label>
            <Input id="confirm-slug" autoComplete="off" value={confirmSlug} onChange={(e) => setConfirmSlug(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDeleteWorkspace(false)}>{t("common.cancel")}</Button>
            <Button variant="destructive" disabled={deletingWorkspace || confirmSlug !== workspaceSlug} onClick={deleteWorkspace} data-testid="confirm-delete-workspace">
              {deletingWorkspace && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{t("st.deleteWsBtn")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
