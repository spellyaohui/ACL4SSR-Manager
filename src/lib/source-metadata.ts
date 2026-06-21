import type { ProfileSource } from "@prisma/client";

import { prisma } from "./db";

const METADATA_TTL_MS = 1000 * 60 * 10;

export type SubscriptionUserInfo = {
  upload: number;
  download: number;
  total: number;
  expire: number | null;
};

export type SourceStatus = {
  ok: boolean;
  checkedAt: string;
  userInfo?: SubscriptionUserInfo;
  message?: string;
};

export function parseSubscriptionUserInfo(header: string | null): SubscriptionUserInfo | null {
  if (!header) return null;
  const parts = new Map(
    header
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const [key, ...valueParts] = part.split("=");
        return [key.trim().toLowerCase(), valueParts.join("=").trim()] as const;
      }),
  );
  const upload = Number(parts.get("upload"));
  const download = Number(parts.get("download"));
  const total = Number(parts.get("total"));
  const expireRaw = parts.get("expire");
  const expire = expireRaw ? Number(expireRaw) : null;

  if (!Number.isFinite(upload) || !Number.isFinite(download) || !Number.isFinite(total)) {
    return null;
  }
  return {
    upload,
    download,
    total,
    expire: expire !== null && Number.isFinite(expire) ? expire : null,
  };
}

function shouldRefreshSource(source: ProfileSource, force: boolean): boolean {
  if (source.type !== "SUBSCRIPTION" || !source.enabled) return false;
  if (!/^https?:\/\//i.test(source.value.trim())) return false;
  if (force || !source.lastCheckedAt) return true;
  return Date.now() - source.lastCheckedAt.getTime() > METADATA_TTL_MS;
}

async function fetchSubscriptionStatus(source: ProfileSource): Promise<SourceStatus> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 7000);
  try {
    const response = await fetch(source.value.trim(), {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent": "acl4ssr-rule-manager/0.1",
        "Range": "bytes=0-0",
      },
    });
    const userInfo = parseSubscriptionUserInfo(response.headers.get("subscription-userinfo"));
    return {
      ok: response.ok,
      checkedAt: new Date().toISOString(),
      userInfo: userInfo ?? undefined,
      message: userInfo ? undefined : `未发现 subscription-userinfo 响应头，HTTP ${response.status}`,
    };
  } catch (error) {
    return {
      ok: false,
      checkedAt: new Date().toISOString(),
      message: error instanceof Error ? error.message : "订阅源元信息读取失败",
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function refreshSourceMetadata(sources: ProfileSource[], force = false): Promise<void> {
  const targets = sources.filter((source) => shouldRefreshSource(source, force));
  await Promise.all(targets.map(async (source) => {
    const status = await fetchSubscriptionStatus(source);
    await prisma.profileSource.update({
      where: { id: source.id },
      data: {
        lastStatus: JSON.stringify(status),
        lastCheckedAt: new Date(status.checkedAt),
      },
    });
  }));
}
