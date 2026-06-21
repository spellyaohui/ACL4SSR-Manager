"use client";

import {
  Activity,
  AlertTriangle,
  Clipboard,
  Database,
  FileCode2,
  Layers3,
  Moon,
  Plus,
  RefreshCw,
  Search,
  Server,
  Settings,
  ShieldCheck,
  Sun,
  Trash2,
  Upload,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

type Profile = {
  id: string;
  name: string;
  description: string | null;
  token: string;
  defaultTarget: string;
  upstreamConfigUrl: string;
  nodeExcludeRegex: string | null;
  subscriptionInfoSourceId: string | null;
  _count?: { sources: number; rules: number };
};

type Source = {
  id: string;
  name: string;
  type: "SUBSCRIPTION" | "NODE" | "BULK";
  value: string;
  tag: string | null;
  enabled: boolean;
  sortOrder: number;
  lastStatus: string | null;
  lastCheckedAt: string | null;
};

type Rule = {
  id: string;
  category: string;
  type: string;
  value: string;
  policyGroup: string;
  mode: "PIN" | "FILTER" | "DIAGNOSE";
  enabled: boolean;
  priority: number;
  note: string | null;
};

type Diagnosis = {
  rule: {
    id?: string;
    category: string;
    type: string;
    value: string;
    policyGroup: string;
    mode: string;
  };
  status: "NO_UPSTREAM_MATCH" | "SAME_GROUP" | "OVERRIDE_REQUIRED" | "DIAGNOSE_ONLY";
  recommendation: "PIN" | "FILTER" | "DIAGNOSE";
  firstMatch?: {
    group: string;
    source: string;
    raw: string;
  };
};

const navItems = [
  { id: "dashboard", label: "Dashboard", icon: Activity },
  { id: "profiles", label: "Profiles", icon: Layers3 },
  { id: "sources", label: "订阅源", icon: Server },
  { id: "rules", label: "规则", icon: ShieldCheck },
  { id: "preview", label: "生成预览", icon: FileCode2 },
  { id: "settings", label: "设置", icon: Settings },
] as const;

const ruleTypes = [
  "DOMAIN",
  "DOMAIN-SUFFIX",
  "DOMAIN-KEYWORD",
  "IP-CIDR",
  "IP-CIDR6",
  "PROCESS-NAME",
  "GEOIP",
  "FINAL",
  "MATCH",
];

const policyGroups = [
  "🚀 节点选择",
  "🚀 手动切换",
  "♻️ 自动选择",
  "🎯 全球直连",
  "💬 Ai平台",
  "🇭🇰 香港节点",
  "🇨🇳 台湾节点",
  "🇸🇬 狮城节点",
  "🇯🇵 日本节点",
  "🇺🇲 美国节点",
  "🇰🇷 韩国节点",
  "🛑 广告拦截",
  "🍃 应用净化",
  "🐟 漏网之鱼",
];

const ruleModes = [
  { value: "PIN", label: "置顶覆盖" },
  { value: "FILTER", label: "过滤上游" },
  { value: "DIAGNOSE", label: "仅诊断" },
] as const;

function displayRuleType(type: string) {
  return type.replaceAll("_", "-");
}

type SourceStatus = {
  ok: boolean;
  checkedAt: string;
  userInfo?: {
    upload: number;
    download: number;
    total: number;
    expire: number | null;
  };
  message?: string;
};

function parseSourceStatus(value: string | null): SourceStatus | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as SourceStatus;
  } catch {
    return { ok: false, checkedAt: "", message: value };
  }
}

function formatBytes(value: number): string {
  if (!Number.isFinite(value) || value < 0) return "-";
  const units = ["B", "KiB", "MiB", "GiB", "TiB"];
  let size = value;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return `${size.toFixed(unit === 0 ? 0 : 2)} ${units[unit]}`;
}

function formatExpire(value: number | null | undefined): string {
  if (!value) return "未提供到期";
  const date = new Date(value * 1000);
  if (Number.isNaN(date.getTime())) return "未提供到期";
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error?.message ?? "Request failed");
  }
  return data as T;
}

function Button({
  children,
  variant = "primary",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" | "danger" }) {
  const variants = {
    primary: "bg-primary text-primary-foreground hover:opacity-90",
    secondary: "border border-border bg-card hover:bg-muted",
    ghost: "hover:bg-muted",
    danger: "bg-destructive text-destructive-foreground hover:opacity-90",
  };
  return (
    <button
      className={`inline-flex min-h-9 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="grid gap-1.5 text-sm font-medium">
      <span>{label}</span>
      {children}
    </label>
  );
}

function inputClass() {
  return "min-h-9 min-w-0 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none";
}

function Badge({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "good" | "warn" | "info" }) {
  const tones = {
    neutral: "border-border bg-muted text-muted-foreground",
    good: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    warn: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
    info: "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300",
  };
  return <span className={`inline-flex rounded-md border px-2 py-0.5 text-xs font-medium ${tones[tone]}`}>{children}</span>;
}

function LoginView({ onLogin }: { onLogin: () => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    try {
      await api("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ password }),
      });
      onLogin();
    } catch (err) {
      setError(err instanceof Error ? err.message : "登录失败");
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-start bg-background p-4 sm:justify-center">
      <form onSubmit={submit} className="login-panel rounded-lg border border-border bg-card p-6 shadow-sm">
        <div className="mb-6">
          <div className="mb-3 inline-flex rounded-md bg-accent p-2 text-accent-foreground">
            <Database size={20} />
          </div>
          <h1 className="text-xl font-semibold">ACL4SSR Rule Manager</h1>
          <p className="mt-1 text-sm text-muted-foreground">输入管理员密码进入自托管规则平台。</p>
        </div>
        <Field label="管理员密码">
          <input
            className={inputClass()}
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </Field>
        {error ? <p className="mt-3 text-sm text-destructive" role="alert">{error}</p> : null}
        <Button className="mt-5 w-full" type="submit">登录</Button>
      </form>
    </main>
  );
}

export function RuleManagerApp() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [dark, setDark] = useState(false);
  const [activeTab, setActiveTab] = useState<(typeof navItems)[number]["id"]>("dashboard");
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState("");
  const [sources, setSources] = useState<Source[]>([]);
  const [rules, setRules] = useState<Rule[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [editingSource, setEditingSource] = useState<Source | null>(null);
  const [drawerRule, setDrawerRule] = useState<Rule | null>(null);
  const [selectedRuleIds, setSelectedRuleIds] = useState<string[]>([]);
  const [ruleDiagnostics, setRuleDiagnostics] = useState<Record<string, Diagnosis>>({});
  const [ruleDiagnosticsLoading, setRuleDiagnosticsLoading] = useState(false);
  const [ruleDiagnosticsError, setRuleDiagnosticsError] = useState("");
  const [preview, setPreview] = useState<{ config: string; subscriptionUrl: string; subconverterUrl: string; rulePreview: string[]; sourceItems: string[] } | null>(null);

  const selectedProfile = profiles.find((profile) => profile.id === selectedProfileId);
  const filteredRules = useMemo(() => {
    const value = search.trim().toLowerCase();
    if (!value) return rules;
    return rules.filter((rule) =>
      [rule.category, rule.type, rule.value, rule.policyGroup, rule.mode, rule.note ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(value),
    );
  }, [rules, search]);

  const loadProfiles = useCallback(async () => {
    const data = await api<{ data: Profile[] }>("/api/profiles");
    setProfiles(data.data);
    setSelectedProfileId((current) => current || data.data[0]?.id || "");
  }, []);

  const loadSources = useCallback(async (profileId = selectedProfileId, refresh = false) => {
    if (!profileId) return;
    const data = await api<{ data: Source[] }>(`/api/profiles/${profileId}/sources${refresh ? "?refresh=1" : ""}`);
    setSources(data.data);
  }, [selectedProfileId]);

  const loadRuleDiagnostics = useCallback(async (profileId = selectedProfileId) => {
    if (!profileId) return;
    setRuleDiagnosticsLoading(true);
    setRuleDiagnosticsError("");
    try {
      const data = await api<{ data: Diagnosis[] }>("/api/rules/diagnose", {
        method: "POST",
        body: JSON.stringify({ profileId }),
      });
      setRuleDiagnostics(Object.fromEntries(
        data.data
          .filter((item) => item.rule.id)
          .map((item) => [item.rule.id as string, item]),
      ));
    } catch (error) {
      setRuleDiagnostics({});
      setRuleDiagnosticsError(error instanceof Error ? error.message : "规则诊断失败");
    } finally {
      setRuleDiagnosticsLoading(false);
    }
  }, [selectedProfileId]);

  const loadRules = useCallback(async (profileId = selectedProfileId) => {
    if (!profileId) return;
    const [data] = await Promise.all([
      api<{ data: Rule[] }>(`/api/rules?profileId=${profileId}`),
      loadRuleDiagnostics(profileId),
    ]);
    setRules(data.data);
  }, [selectedProfileId, loadRuleDiagnostics]);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  useEffect(() => {
    api<{ authenticated: boolean }>("/api/auth/me")
      .then((data) => setAuthenticated(data.authenticated))
      .catch(() => setAuthenticated(false));
  }, []);

  useEffect(() => {
    if (authenticated) void loadProfiles();
  }, [authenticated, loadProfiles]);

  useEffect(() => {
    if (selectedProfileId) {
      void loadSources(selectedProfileId);
      void loadRules(selectedProfileId);
      setPreview(null);
      setRuleDiagnostics({});
      setRuleDiagnosticsError("");
      setEditingSource(null);
      setSelectedRuleIds([]);
    }
  }, [selectedProfileId, loadSources, loadRules]);

  async function createProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await api("/api/profiles", {
      method: "POST",
      body: JSON.stringify({
        name: form.get("name"),
        description: form.get("description"),
        defaultTarget: form.get("defaultTarget") || "clash",
      }),
    });
    event.currentTarget.reset();
    setStatus("Profile 已创建");
    await loadProfiles();
  }

  async function createOrUpdateSource(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedProfileId) return;
    const form = new FormData(event.currentTarget);
    const data = await api<{ data: Source }>(editingSource ? `/api/profiles/${selectedProfileId}/sources/${editingSource.id}` : `/api/profiles/${selectedProfileId}/sources`, {
      method: editingSource ? "PATCH" : "POST",
      body: JSON.stringify({
        name: form.get("name"),
        type: form.get("type"),
        value: form.get("value"),
        tag: form.get("tag") || null,
        sortOrder: Number(form.get("sortOrder") || sources.length),
        enabled: form.get("enabled") === "on",
      }),
    });
    event.currentTarget.reset();
    setSources((current) => {
      if (editingSource) {
        return current.map((source) => source.id === data.data.id ? data.data : source);
      }
      return [...current, data.data].sort((a, b) => a.sortOrder - b.sortOrder);
    });
    setEditingSource(null);
    setPreview(null);
    setStatus(editingSource ? "订阅源已更新，列表已刷新" : "订阅源已添加，列表已刷新");
    await Promise.all([loadSources(), loadProfiles()]);
  }

  async function toggleSource(source: Source) {
    await api(`/api/profiles/${selectedProfileId}/sources/${source.id}`, {
      method: "PATCH",
      body: JSON.stringify({ enabled: !source.enabled }),
    });
    await loadSources();
  }

  async function deleteSource(source: Source) {
    if (!window.confirm(`删除订阅源 ${source.name}？`)) return;
    await api(`/api/profiles/${selectedProfileId}/sources/${source.id}`, { method: "DELETE" });
    if (editingSource?.id === source.id) setEditingSource(null);
    await loadSources();
  }

  async function createOrUpdateRule(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedProfileId) return;
    const form = new FormData(event.currentTarget);
    const payload = {
      profileId: selectedProfileId,
      category: form.get("category") || "General",
      type: form.get("type"),
      value: form.get("value") || "",
      policyGroup: form.get("policyGroup"),
      mode: form.get("mode"),
      priority: Number(form.get("priority") || 0),
      enabled: form.get("enabled") === "on",
      note: form.get("note") || null,
    };
    await api(drawerRule ? `/api/rules/${drawerRule.id}` : "/api/rules", {
      method: drawerRule ? "PATCH" : "POST",
      body: JSON.stringify(drawerRule ? { ...payload, profileId: undefined } : payload),
    });
    setDrawerRule(null);
    setStatus(drawerRule ? "规则已更新" : "规则已添加");
    await loadRules();
  }

  async function toggleRule(rule: Rule) {
    await api(`/api/rules/${rule.id}`, {
      method: "PATCH",
      body: JSON.stringify({ enabled: !rule.enabled }),
    });
    await loadRules();
  }

  async function batchUpdateRules(patch: Partial<Pick<Rule, "enabled" | "policyGroup" | "mode">>) {
    if (!selectedRuleIds.length) return;
    await Promise.all(selectedRuleIds.map((id) =>
      api(`/api/rules/${id}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      }),
    ));
    setSelectedRuleIds([]);
    setStatus(`已批量更新 ${selectedRuleIds.length} 条规则`);
    await loadRules();
  }

  async function deleteRule(rule: Rule) {
    if (!window.confirm(`删除规则 ${displayRuleType(rule.type)},${rule.value || rule.policyGroup}？`)) return;
    await api(`/api/rules/${rule.id}`, { method: "DELETE" });
    await loadRules();
  }

  async function importRules(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedProfileId) return;
    const form = new FormData(event.currentTarget);
    const data = await api<{ data: Rule[]; errors: Array<{ line: number; message: string }> }>("/api/rules/import", {
      method: "POST",
      body: JSON.stringify({
        profileId: selectedProfileId,
        text: form.get("text"),
        mode: form.get("mode"),
      }),
    });
    setStatus(`已导入 ${data.data.length} 条规则，错误 ${data.errors.length} 条`);
    await loadRules();
  }

  async function loadPreview() {
    if (!selectedProfileId) return;
    const data = await api<{ data: typeof preview }>(`/api/profiles/${selectedProfileId}/preview`);
    setPreview(data.data);
  }

  async function updateProfilePatch(patch: Partial<Pick<Profile, "name" | "description" | "defaultTarget" | "upstreamConfigUrl" | "nodeExcludeRegex" | "subscriptionInfoSourceId">>, message: string) {
    if (!selectedProfile) return;
    const data = await api<{ data: Profile }>(`/api/profiles/${selectedProfile.id}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
    setProfiles((current) => current.map((profile) => profile.id === data.data.id ? { ...profile, ...data.data } : profile));
    setPreview(null);
    setStatus(message);
  }

  async function updateSelectedProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedProfile) return;
    const form = new FormData(event.currentTarget);
    await updateProfilePatch({
      name: selectedProfile.name,
      description: selectedProfile.description,
      defaultTarget: String(form.get("defaultTarget") || "clash"),
      upstreamConfigUrl: String(form.get("upstreamConfigUrl") || selectedProfile.upstreamConfigUrl),
      nodeExcludeRegex: String(form.get("nodeExcludeRegex") || "").trim() || null,
      subscriptionInfoSourceId: String(form.get("subscriptionInfoSourceId") || "").trim() || null,
    }, "设置已保存");
  }

  async function updateNodeFilter(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await updateProfilePatch({
      nodeExcludeRegex: String(form.get("nodeExcludeRegex") || "").trim() || null,
    }, "节点过滤已保存，下一次订阅生成会自动生效");
  }

  async function updateSubscriptionInfoSource(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await updateProfilePatch({
      subscriptionInfoSourceId: String(form.get("subscriptionInfoSourceId") || "").trim() || null,
    }, "流量/到期来源已保存，下一次订阅响应会自动使用");
  }

  async function logout() {
    await api("/api/auth/logout", { method: "POST" });
    setAuthenticated(false);
  }

  if (authenticated === null) {
    return <main className="grid min-h-screen place-items-center bg-background text-sm text-muted-foreground">加载中...</main>;
  }
  if (!authenticated) {
    return <LoginView onLogin={() => setAuthenticated(true)} />;
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="grid min-h-screen lg:grid-cols-[248px_1fr]">
        <aside className="border-b border-border bg-card lg:border-b-0 lg:border-r">
          <div className="flex items-center justify-between gap-3 px-4 py-4">
            <div>
              <div className="text-sm font-semibold">ACL4SSR Manager</div>
              <div className="text-xs text-muted-foreground">规则与订阅转换平台</div>
            </div>
            <Button
              type="button"
              variant="ghost"
              aria-label="Toggle dark mode"
              className="px-2"
              onClick={() => setDark((value) => !value)}
            >
              {dark ? <Sun size={17} /> : <Moon size={17} />}
            </Button>
          </div>
          <nav className="flex gap-1 overflow-x-auto px-3 pb-3 lg:grid lg:overflow-visible" aria-label="Main navigation">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  className={`flex min-h-10 min-w-max items-center gap-2 rounded-md px-3 text-sm transition lg:min-w-0 ${
                    activeTab === item.id ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                  onClick={() => setActiveTab(item.id)}
                >
                  <Icon size={16} />
                  {item.label}
                </button>
              );
            })}
          </nav>
          <div className="hidden border-t border-border p-3 lg:block">
            <label className="grid gap-1 text-xs text-muted-foreground">
              当前 Profile
              <select className={inputClass()} value={selectedProfileId} onChange={(event) => setSelectedProfileId(event.target.value)}>
                {profiles.map((profile) => (
                  <option key={profile.id} value={profile.id}>{profile.name}</option>
                ))}
              </select>
            </label>
          </div>
        </aside>

        <section className="min-w-0">
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-card px-4 py-3">
            <div>
              <h1 className="text-lg font-semibold">{navItems.find((item) => item.id === activeTab)?.label}</h1>
              <p className="text-sm text-muted-foreground">
                {selectedProfile ? `${selectedProfile.name} · token ${selectedProfile.token.slice(0, 8)}...` : "先创建一个 Profile"}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="secondary" onClick={() => navigator.clipboard.writeText(selectedProfile ? `${location.origin}/sub/${selectedProfile.token}?target=clash` : "")}>
                <Clipboard size={16} />
                复制订阅 URL
              </Button>
              <Button variant="ghost" onClick={() => void loadProfiles()}>
                <RefreshCw size={16} />
                刷新
              </Button>
              <Button variant="ghost" onClick={() => void logout()}>退出</Button>
            </div>
          </header>

          {status ? (
            <div className="mx-4 mt-4 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300" role="status">
              {status}
            </div>
          ) : null}

          <div className="p-4">
            {activeTab === "dashboard" ? (
              <Dashboard profiles={profiles} sources={sources} rules={rules} />
            ) : null}

            {activeTab === "profiles" ? (
              <ProfilesView profiles={profiles} onCreate={createProfile} />
            ) : null}

            {activeTab === "sources" ? (
              <SourcesView
                selectedProfile={selectedProfile}
                sources={sources}
                editingSource={editingSource}
                onCreate={createOrUpdateSource}
                onUpdateNodeFilter={updateNodeFilter}
                onUpdateSubscriptionInfoSource={updateSubscriptionInfoSource}
                onEdit={setEditingSource}
                onCancelEdit={() => setEditingSource(null)}
                onToggle={toggleSource}
                onDelete={deleteSource}
                onReload={() => loadSources(selectedProfileId, true)}
              />
            ) : null}

            {activeTab === "rules" ? (
              <RulesView
                rules={filteredRules}
                search={search}
                setSearch={setSearch}
                diagnostics={ruleDiagnostics}
                diagnosticsLoading={ruleDiagnosticsLoading}
                diagnosticsError={ruleDiagnosticsError}
                onRefreshDiagnostics={() => loadRuleDiagnostics()}
                selectedRuleIds={selectedRuleIds}
                setSelectedRuleIds={setSelectedRuleIds}
                onBatchUpdate={batchUpdateRules}
                onAdd={() => setDrawerRule({
                  id: "",
                  category: "General",
                  type: "DOMAIN-SUFFIX",
                  value: "",
                  policyGroup: "🚀 节点选择",
                  mode: "PIN",
                  enabled: true,
                  priority: rules.length,
                  note: null,
                })}
                onEdit={setDrawerRule}
                onToggle={toggleRule}
                onDelete={deleteRule}
              />
            ) : null}

            {activeTab === "preview" ? (
              <PreviewView selectedProfile={selectedProfile} preview={preview} onLoad={loadPreview} />
            ) : null}

            {activeTab === "settings" ? (
              <SettingsView selectedProfile={selectedProfile} sources={sources} onSubmit={updateSelectedProfile} />
            ) : null}
          </div>
        </section>
      </div>

      {drawerRule ? (
        <RuleDrawer
          rule={drawerRule.id ? drawerRule : null}
          initial={drawerRule}
          onClose={() => setDrawerRule(null)}
          onSubmit={createOrUpdateRule}
        />
      ) : null}

      {activeTab === "rules" ? <ImportPanel onImport={importRules} /> : null}
    </main>
  );
}

function Dashboard({ profiles, sources, rules }: { profiles: Profile[]; sources: Source[]; rules: Rule[] }) {
  const activeRules = rules.filter((rule) => rule.enabled).length;
  return (
    <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
      <div className="grid gap-3 sm:grid-cols-3">
        <Metric label="Profiles" value={profiles.length} icon={<Layers3 size={18} />} />
        <Metric label="启用订阅源" value={sources.filter((source) => source.enabled).length} icon={<Server size={18} />} />
        <Metric label="启用规则" value={activeRules} icon={<ShieldCheck size={18} />} />
      </div>
      <div className="rounded-lg border border-border bg-card p-4">
        <h2 className="text-sm font-semibold">运行说明</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          客户端使用本平台的 `/sub/:token` 地址。平台会实时读取 SQLite 中的订阅源和规则，生成动态外部配置，再调用内部 subconverter。
        </p>
      </div>
    </div>
  );
}

function Metric({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="mb-3 inline-flex rounded-md bg-accent p-2 text-accent-foreground">{icon}</div>
      <div className="text-2xl font-semibold">{value}</div>
      <div className="text-sm text-muted-foreground">{label}</div>
    </div>
  );
}

function ProfilesView({ profiles, onCreate }: { profiles: Profile[]; onCreate: (event: React.FormEvent<HTMLFormElement>) => void }) {
  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
      <TableShell>
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-border text-xs text-muted-foreground">
            <tr><th className="p-3">名称</th><th>输出</th><th>订阅源</th><th>规则</th><th>Token</th></tr>
          </thead>
          <tbody>
            {profiles.map((profile) => (
              <tr key={profile.id} className="border-b border-border/70">
                <td className="p-3 font-medium">{profile.name}<div className="text-xs text-muted-foreground">{profile.description}</div></td>
                <td>{profile.defaultTarget}</td>
                <td>{profile._count?.sources ?? 0}</td>
                <td>{profile._count?.rules ?? 0}</td>
                <td className="break-all text-xs text-muted-foreground">{profile.token}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableShell>
      <form onSubmit={onCreate} className="rounded-lg border border-border bg-card p-4">
        <h2 className="mb-3 text-sm font-semibold">新建 Profile</h2>
        <div className="grid gap-3">
          <Field label="名称"><input className={inputClass()} name="name" required placeholder="主力配置" /></Field>
          <Field label="描述"><textarea className={inputClass()} name="description" rows={3} /></Field>
          <Field label="默认 target"><input className={inputClass()} name="defaultTarget" defaultValue="clash" /></Field>
          <Button type="submit"><Plus size={16} />创建</Button>
        </div>
      </form>
    </div>
  );
}

function SourcesView({
  selectedProfile,
  sources,
  editingSource,
  onCreate,
  onUpdateNodeFilter,
  onUpdateSubscriptionInfoSource,
  onEdit,
  onCancelEdit,
  onToggle,
  onDelete,
  onReload,
}: {
  selectedProfile?: Profile;
  sources: Source[];
  editingSource: Source | null;
  onCreate: (event: React.FormEvent<HTMLFormElement>) => void;
  onUpdateNodeFilter: (event: React.FormEvent<HTMLFormElement>) => void;
  onUpdateSubscriptionInfoSource: (event: React.FormEvent<HTMLFormElement>) => void;
  onEdit: (source: Source) => void;
  onCancelEdit: () => void;
  onToggle: (source: Source) => void;
  onDelete: (source: Source) => void;
  onReload: () => void;
}) {
  const subscriptionSources = sources.filter((source) => source.type === "SUBSCRIPTION");
  const selectedInfoSource = sources.find((source) => source.id === selectedProfile?.subscriptionInfoSourceId);
  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_420px]">
      <TableShell>
        <table className="w-full min-w-[980px] text-left text-sm">
          <thead className="border-b border-border text-xs text-muted-foreground">
            <tr><th className="p-3">名称</th><th>类型</th><th>状态</th><th>用量/到期</th><th>排序</th><th>内容</th><th>操作</th></tr>
          </thead>
          <tbody>
            {sources.map((source) => {
              const sourceStatus = parseSourceStatus(source.lastStatus);
              const userInfo = sourceStatus?.userInfo;
              const used = userInfo ? userInfo.upload + userInfo.download : null;
              return (
                <tr key={source.id} className="border-b border-border/70">
                  <td className="p-3 font-medium">{source.name}<div className="text-xs text-muted-foreground">{source.tag}</div></td>
                  <td><Badge tone="info">{source.type}</Badge></td>
                  <td>{source.enabled ? <Badge tone="good">启用</Badge> : <Badge>停用</Badge>}</td>
                  <td className="min-w-[160px] text-xs">
                    {userInfo ? (
                      <div className="grid gap-1">
                        <span className="font-medium">{formatBytes(used ?? 0)} / {formatBytes(userInfo.total)}</span>
                        <span className="text-muted-foreground">{formatExpire(userInfo.expire)}</span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">{sourceStatus?.message ?? "未获取"}</span>
                    )}
                  </td>
                  <td>{source.sortOrder}</td>
                  <td className="max-w-[420px] break-all text-xs text-muted-foreground">{source.value}</td>
                  <td>
                    <div className="flex gap-1">
                      <Button variant="ghost" onClick={() => onEdit(source)}>编辑</Button>
                      <Button variant="ghost" onClick={() => onToggle(source)}>{source.enabled ? "停用" : "启用"}</Button>
                      <Button variant="ghost" aria-label="Delete source" onClick={() => onDelete(source)}><Trash2 size={15} /></Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </TableShell>
      <div className="grid content-start gap-4">
        <form key={`subscription-info-${selectedProfile?.id ?? "none"}`} onSubmit={onUpdateSubscriptionInfoSource} className="rounded-lg border border-border bg-card p-4">
          <div className="mb-3">
            <h2 className="text-sm font-semibold">流量/到期来源</h2>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              指定 `/sub` 响应头里的用量和到期时间读取哪个机场订阅 URL。
            </p>
          </div>
          <div className="grid gap-3">
            <Field label="指定订阅源">
              <select
                className={inputClass()}
                name="subscriptionInfoSourceId"
                defaultValue={selectedProfile?.subscriptionInfoSourceId ?? ""}
                disabled={!selectedProfile || !subscriptionSources.length}
              >
                <option value="">自动汇总所有机场订阅</option>
                {subscriptionSources.map((source) => (
                  <option key={source.id} value={source.id}>{source.name}{source.enabled ? "" : "（已停用）"}</option>
                ))}
              </select>
            </Field>
            <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
              <span className="break-all">
                当前：{selectedInfoSource ? selectedInfoSource.name : "自动汇总所有机场订阅"}
              </span>
              <Button type="submit" variant="secondary" disabled={!selectedProfile}>保存来源</Button>
            </div>
          </div>
        </form>
        <form key={`node-filter-${selectedProfile?.id ?? "none"}`} onSubmit={onUpdateNodeFilter} className="rounded-lg border border-border bg-card p-4">
          <div className="mb-3">
            <h2 className="text-sm font-semibold">节点名称过滤</h2>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              写入 subconverter 的 exclude_remarks，过滤节点名称命中的内容，例如 <span className="font-mono">官网|到期时间|剩余流量</span>。
            </p>
          </div>
          <div className="grid gap-3">
            <Field label="排除正则">
              <input
                className={inputClass()}
                name="nodeExcludeRegex"
                defaultValue={selectedProfile?.nodeExcludeRegex ?? ""}
                placeholder="官网|到期时间|剩余流量"
                disabled={!selectedProfile}
              />
            </Field>
            <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
              <span className="break-all">
                当前：{selectedProfile?.nodeExcludeRegex ? <span className="font-mono">{selectedProfile.nodeExcludeRegex}</span> : "未启用"}
              </span>
              <Button type="submit" variant="secondary" disabled={!selectedProfile}>保存过滤</Button>
            </div>
          </div>
        </form>
        <form key={editingSource?.id ?? "new-source"} onSubmit={onCreate} className="rounded-lg border border-border bg-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">{editingSource ? "编辑订阅源" : "添加订阅源"}</h2>
            <div className="flex gap-1">
              {editingSource ? <Button type="button" variant="ghost" onClick={onCancelEdit}>取消</Button> : null}
              <Button type="button" variant="ghost" onClick={onReload}><RefreshCw size={15} />刷新元信息</Button>
            </div>
          </div>
          <div className="grid gap-3">
            <Field label="名称"><input className={inputClass()} name="name" required defaultValue={editingSource?.name ?? ""} placeholder="机场 A / 手动节点" /></Field>
            <Field label="类型">
              <select className={inputClass()} name="type" defaultValue={editingSource?.type ?? "SUBSCRIPTION"}>
                <option value="SUBSCRIPTION">机场订阅 URL</option>
                <option value="NODE">单条节点直链</option>
                <option value="BULK">批量节点</option>
              </select>
            </Field>
            <Field label="内容"><textarea className={inputClass()} name="value" required rows={7} defaultValue={editingSource?.value ?? ""} placeholder="https://... 或 vmess://..." /></Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Tag"><input className={inputClass()} name="tag" defaultValue={editingSource?.tag ?? ""} placeholder="可选" /></Field>
              <Field label="排序"><input className={inputClass()} name="sortOrder" type="number" defaultValue={editingSource?.sortOrder ?? sources.length} /></Field>
            </div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="enabled" defaultChecked={editingSource?.enabled ?? true} />启用</label>
            <Button type="submit"><Plus size={16} />{editingSource ? "保存" : "添加"}</Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function RulesView({
  rules,
  search,
  setSearch,
  diagnostics,
  diagnosticsLoading,
  diagnosticsError,
  onRefreshDiagnostics,
  selectedRuleIds,
  setSelectedRuleIds,
  onBatchUpdate,
  onAdd,
  onEdit,
  onToggle,
  onDelete,
}: {
  rules: Rule[];
  search: string;
  setSearch: (value: string) => void;
  diagnostics: Record<string, Diagnosis>;
  diagnosticsLoading: boolean;
  diagnosticsError: string;
  onRefreshDiagnostics: () => void;
  selectedRuleIds: string[];
  setSelectedRuleIds: (ids: string[]) => void;
  onBatchUpdate: (patch: Partial<Pick<Rule, "enabled" | "policyGroup" | "mode">>) => void;
  onAdd: () => void;
  onEdit: (rule: Rule) => void;
  onToggle: (rule: Rule) => void;
  onDelete: (rule: Rule) => void;
}) {
  const [batchPolicy, setBatchPolicy] = useState(policyGroups[0]);
  const allSelected = rules.length > 0 && rules.every((rule) => selectedRuleIds.includes(rule.id));
  const conflictCount = rules.filter((rule) => diagnostics[rule.id]?.status === "OVERRIDE_REQUIRED").length;
  const duplicateCount = rules.filter((rule) => diagnostics[rule.id]?.status === "SAME_GROUP").length;
  const toggleSelection = (ruleId: string) => {
    setSelectedRuleIds(
      selectedRuleIds.includes(ruleId)
        ? selectedRuleIds.filter((id) => id !== ruleId)
        : [...selectedRuleIds, ruleId],
    );
  };

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="relative min-w-[240px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-2.5 text-muted-foreground" size={16} />
          <input className={`${inputClass()} pl-9`} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜索规则、分类、策略组" />
        </label>
        <Button variant="secondary" onClick={onRefreshDiagnostics} disabled={diagnosticsLoading}>
          <RefreshCw size={16} />
          {diagnosticsLoading ? "诊断中" : "刷新诊断"}
        </Button>
        <Button onClick={onAdd}><Plus size={16} />新增规则</Button>
      </div>
      <div className={`flex flex-wrap items-center gap-2 rounded-lg border p-2 text-sm ${
        conflictCount
          ? "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-200"
          : "border-border bg-card text-muted-foreground"
      }`}>
        <AlertTriangle size={16} />
        <span>{diagnosticsLoading ? "正在扫描上游规则" : conflictCount ? `发现 ${conflictCount} 条异组冲突` : "当前列表没有异组冲突"}</span>
        {duplicateCount ? <Badge tone="good">同策略重复 {duplicateCount}</Badge> : null}
        {diagnosticsError ? <span className="text-destructive">{diagnosticsError}</span> : null}
      </div>
      {selectedRuleIds.length ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card p-2 text-sm">
          <Badge tone="info">已选 {selectedRuleIds.length}</Badge>
          <Button variant="ghost" onClick={() => onBatchUpdate({ enabled: true })}>批量启用</Button>
          <Button variant="ghost" onClick={() => onBatchUpdate({ enabled: false })}>批量停用</Button>
          <select className={`${inputClass()} max-w-[220px]`} value={batchPolicy} onChange={(event) => setBatchPolicy(event.target.value)}>
            {policyGroups.map((group) => <option key={group} value={group}>{group}</option>)}
          </select>
          <Button variant="secondary" onClick={() => onBatchUpdate({ policyGroup: batchPolicy })}>批量改策略组</Button>
          <Button variant="ghost" onClick={() => setSelectedRuleIds([])}>清空选择</Button>
        </div>
      ) : null}
      <TableShell>
        <table className="w-full min-w-[980px] text-left text-sm">
          <thead className="border-b border-border text-xs text-muted-foreground">
            <tr>
              <th className="p-3">
                <input
                  type="checkbox"
                  aria-label="Select all rules"
                  checked={allSelected}
                  onChange={(event) => setSelectedRuleIds(event.target.checked ? rules.map((rule) => rule.id) : [])}
                />
              </th>
              <th>分类</th><th>规则</th><th>策略组</th><th>模式</th><th>冲突</th><th>状态</th><th>备注</th><th>操作</th>
            </tr>
          </thead>
          <tbody>
            {rules.map((rule) => (
              <tr key={rule.id} className="border-b border-border/70 align-top">
                <td className="p-3">
                  <input
                    type="checkbox"
                    aria-label={`Select ${rule.value || rule.policyGroup}`}
                    checked={selectedRuleIds.includes(rule.id)}
                    onChange={() => toggleSelection(rule.id)}
                  />
                </td>
                <td><Badge>{rule.category}</Badge></td>
                <td className="max-w-[320px] break-all font-mono text-xs">{displayRuleType(rule.type)},{rule.value || rule.policyGroup}</td>
                <td>{rule.policyGroup}</td>
                <td><ModeBadge mode={rule.mode} /></td>
                <td className="max-w-[260px]">
                  <InlineDiagnosis diagnosis={diagnostics[rule.id]} loading={diagnosticsLoading} />
                </td>
                <td>{rule.enabled ? <Badge tone="good">启用</Badge> : <Badge>停用</Badge>}</td>
                <td className="max-w-[220px] break-words text-xs text-muted-foreground">{rule.note}</td>
                <td>
                  <div className="flex gap-1">
                    <Button variant="ghost" onClick={() => onEdit(rule)}>编辑</Button>
                    <Button variant="ghost" onClick={() => onToggle(rule)}>{rule.enabled ? "停用" : "启用"}</Button>
                    <Button variant="ghost" aria-label="Delete rule" onClick={() => onDelete(rule)}><Trash2 size={15} /></Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableShell>
    </div>
  );
}

function PreviewView({
  selectedProfile,
  preview,
  onLoad,
}: {
  selectedProfile?: Profile;
  preview: { config: string; subscriptionUrl: string; subconverterUrl: string; rulePreview: string[]; sourceItems: string[] } | null;
  onLoad: () => void;
}) {
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-card p-3 text-sm">
        <div>
          <div className="font-medium">节点过滤</div>
          <div className="mt-1 break-all text-xs text-muted-foreground">
            {selectedProfile?.nodeExcludeRegex ? <span className="font-mono">{selectedProfile.nodeExcludeRegex}</span> : "未启用"}
          </div>
        </div>
        <Button onClick={onLoad}><RefreshCw size={16} />生成预览</Button>
      </div>
      {preview ? (
        <div className="grid gap-4 xl:grid-cols-2">
          <CodePanel title="订阅 URL" content={preview.subscriptionUrl} />
          <CodePanel title="subconverter 实际调用" content={preview.subconverterUrl || "暂无启用订阅源"} />
          <CodePanel title="订阅源合并顺序" content={preview.sourceItems.join("\n") || "暂无启用订阅源"} />
          <CodePanel title="最终规则前 100 条" content={preview.rulePreview.join("\n")} />
          <CodePanel title="动态外部配置" content={preview.config} />
        </div>
      ) : (
        <EmptyState text="点击生成预览查看最终 config 和订阅地址。" />
      )}
    </div>
  );
}

function SettingsView({
  selectedProfile,
  sources,
  onSubmit,
}: {
  selectedProfile?: Profile;
  sources: Source[];
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}) {
  const subscriptionSources = sources.filter((source) => source.type === "SUBSCRIPTION");
  return (
    <form key={selectedProfile?.id ?? "no-profile"} onSubmit={onSubmit} className="grid gap-4 rounded-lg border border-border bg-card p-4">
      <h2 className="text-sm font-semibold">部署参数</h2>
      <dl className="mt-4 grid gap-3 text-sm">
        <div><dt className="text-muted-foreground">当前 Profile Token</dt><dd className="break-all font-mono text-xs">{selectedProfile?.token ?? "未选择"}</dd></div>
        <div><dt className="text-muted-foreground">健康检查</dt><dd className="break-all font-mono text-xs">/health/live · /health/ready</dd></div>
      </dl>
      <div className="grid gap-3">
        <Field label="默认 target">
          <input className={inputClass()} name="defaultTarget" defaultValue={selectedProfile?.defaultTarget ?? "clash"} disabled={!selectedProfile} />
        </Field>
        <Field label="上游配置">
          <input className={inputClass()} name="upstreamConfigUrl" defaultValue={selectedProfile?.upstreamConfigUrl ?? ""} disabled={!selectedProfile} />
        </Field>
        <Field label="流量/到期来源">
          <select
            className={inputClass()}
            name="subscriptionInfoSourceId"
            defaultValue={selectedProfile?.subscriptionInfoSourceId ?? ""}
            disabled={!selectedProfile || !subscriptionSources.length}
          >
            <option value="">自动汇总所有机场订阅</option>
            {subscriptionSources.map((source) => (
              <option key={source.id} value={source.id}>{source.name}{source.enabled ? "" : "（已停用）"}</option>
            ))}
          </select>
        </Field>
        <Field label="节点排除正则">
          <input className={inputClass()} name="nodeExcludeRegex" defaultValue={selectedProfile?.nodeExcludeRegex ?? ""} placeholder="官网|到期时间|剩余流量" disabled={!selectedProfile} />
        </Field>
        <Button type="submit" disabled={!selectedProfile}>保存设置</Button>
      </div>
    </form>
  );
}

function RuleDrawer({
  rule,
  initial,
  onClose,
  onSubmit,
}: {
  rule: Rule | null;
  initial: Rule;
  onClose: () => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <div className="fixed inset-0 z-30 bg-black/30" role="presentation">
      <aside className="ml-auto h-full w-full max-w-xl overflow-y-auto border-l border-border bg-card p-4 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold">{rule ? "编辑规则" : "新增规则"}</h2>
          <Button variant="ghost" onClick={onClose}>关闭</Button>
        </div>
        <form onSubmit={onSubmit} className="grid gap-3">
          <Field label="分类"><input className={inputClass()} name="category" defaultValue={initial.category} /></Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="规则类型">
              <select className={inputClass()} name="type" defaultValue={displayRuleType(initial.type)}>
                {ruleTypes.map((type) => <option key={type} value={type}>{type}</option>)}
              </select>
            </Field>
            <Field label="优先级"><input className={inputClass()} name="priority" type="number" defaultValue={initial.priority} /></Field>
          </div>
          <Field label="规则值"><input className={inputClass()} name="value" defaultValue={initial.value} placeholder="chatgpt.com / lucky / 1.1.1.0/24" /></Field>
          <Field label="策略组">
            <select className={inputClass()} name="policyGroup" defaultValue={initial.policyGroup}>
              {policyGroups.map((group) => <option key={group} value={group}>{group}</option>)}
            </select>
          </Field>
          <Field label="处理模式">
            <select className={inputClass()} name="mode" defaultValue={initial.mode}>
              {ruleModes.map((mode) => <option key={mode.value} value={mode.value}>{mode.label}</option>)}
            </select>
          </Field>
          <Field label="备注"><textarea className={inputClass()} name="note" rows={3} defaultValue={initial.note ?? ""} /></Field>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="enabled" defaultChecked={initial.enabled} />启用</label>
          <Button type="submit">保存规则</Button>
        </form>
      </aside>
    </div>
  );
}

function ImportPanel({ onImport }: { onImport: (event: React.FormEvent<HTMLFormElement>) => void }) {
  return (
    <details className="fixed bottom-4 right-4 z-20 w-[min(520px,calc(100vw-2rem))] rounded-lg border border-border bg-card shadow-lg">
      <summary className="flex cursor-pointer items-center gap-2 px-4 py-3 text-sm font-medium"><Upload size={16} />批量导入规则</summary>
      <form onSubmit={onImport} className="grid gap-3 border-t border-border p-4">
        <select className={inputClass()} name="mode" defaultValue="PIN">
          {ruleModes.map((mode) => <option key={mode.value} value={mode.value}>{mode.label}</option>)}
        </select>
        <textarea className={inputClass()} name="text" rows={8} placeholder="#PT&#10;- DOMAIN-SUFFIX,m-team.cc,🎯 全球直连" />
        <Button type="submit">导入</Button>
      </form>
    </details>
  );
}

function TableShell({ children }: { children: React.ReactNode }) {
  return <div className="overflow-x-auto rounded-lg border border-border bg-card scrollbar-thin">{children}</div>;
}

function EmptyState({ text }: { text: string }) {
  return <div className="rounded-lg border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">{text}</div>;
}

function CodePanel({ title, content }: { title: string; content: string }) {
  return (
    <section className="rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <h2 className="text-sm font-semibold">{title}</h2>
        <Button variant="ghost" className="px-2" aria-label={`Copy ${title}`} onClick={() => navigator.clipboard.writeText(content)}><Clipboard size={15} /></Button>
      </div>
      <pre className="max-h-[420px] overflow-auto whitespace-pre-wrap break-all p-3 text-xs leading-5 text-muted-foreground scrollbar-thin">{content}</pre>
    </section>
  );
}

function InlineDiagnosis({ diagnosis, loading }: { diagnosis?: Diagnosis; loading: boolean }) {
  if (loading && !diagnosis) {
    return <Badge>扫描中</Badge>;
  }
  if (!diagnosis) {
    return <Badge>未诊断</Badge>;
  }

  const sourceName = diagnosis.firstMatch?.source.split("/").pop() ?? "";
  const upstreamHint =
    diagnosis.status === "SAME_GROUP"
      ? "上游已按同策略覆盖"
      : diagnosis.status === "OVERRIDE_REQUIRED"
        ? "上游策略与你设置不同"
        : "上游首个命中规则";

  return (
    <div className="grid gap-1">
      <StatusBadge status={diagnosis.status} />
      {diagnosis.firstMatch ? (
        <div className="grid gap-0.5 text-xs leading-5 text-muted-foreground" title={`上游原始规则：${diagnosis.firstMatch.raw}`}>
          <span className="break-words">{upstreamHint}</span>
          <span className="break-words">上游策略：{diagnosis.firstMatch.group}</span>
          <span className="break-all">来源文件：{sourceName}</span>
        </div>
      ) : null}
    </div>
  );
}

function ModeBadge({ mode }: { mode: Rule["mode"] }) {
  if (mode === "FILTER") return <Badge tone="warn">过滤上游</Badge>;
  if (mode === "DIAGNOSE") return <Badge>仅诊断</Badge>;
  return <Badge tone="info">置顶覆盖</Badge>;
}

function StatusBadge({ status }: { status: Diagnosis["status"] }) {
  if (status === "OVERRIDE_REQUIRED") return <Badge tone="warn">异组冲突</Badge>;
  if (status === "SAME_GROUP") return <Badge tone="good">同策略重复</Badge>;
  if (status === "DIAGNOSE_ONLY") return <Badge>仅诊断</Badge>;
  return <Badge tone="info">未命中上游</Badge>;
}
