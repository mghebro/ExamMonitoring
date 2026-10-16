"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import {
  Bell,
  BellOff,
  Calendar,
  CheckCircle2,
  Clock,
  ExternalLink,
  Gauge,
  LogOut,
  RefreshCw,
  Send,
  Shield,
  ShieldAlert,
  Unlink,
  User,
  Zap,
} from "lucide-react";

function getApiBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    "http://localhost:3001"
  );
}

interface TargetData {
  id: string;
  name: string;
  endpointUrl: string;
  categoryCode?: string;
  pollIntervalSeconds: number;
  isActive: boolean;
  state?: {
    state: "Running" | "Paused" | "Error" | "Stale" | "Unknown";
    lastStatus: "AVAILABLE" | "UNAVAILABLE" | "UNKNOWN";
    lastCheckedAt: string | null;
    lastLatencyMs: number | null;
    consecutiveFailures: number;
    lastError: string | null;
  } | null;
  slots: Array<{
    id: string;
    bookingDate: string;
    bookingDateStatus: number;
    isAvailable: boolean;
  }>;
}

interface UserProfileData {
  user: {
    id: string;
    email: string;
    role: "admin" | "user";
    fullName: string | null;
  };
  telegram: {
    isLinked: boolean;
    telegramUsername: string | null;
    telegramChatId?: number;
    isSubscribed: boolean;
  };
}

export default function DashboardPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfileData | null>(null);
  const [targets, setTargets] = useState<TargetData[]>([]);
  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [linkingLink, setLinkingLink] = useState<string | null>(null);
  const [linkingLoading, setLinkingLoading] = useState(false);
  const [testSending, setTestSending] = useState(false);
  const [testSuccess, setTestSuccess] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Invite form state
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteLinkGenerated, setInviteLinkGenerated] = useState<string | null>(null);

  const fetchDashboardData = async () => {
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        router.push("/login");
        return;
      }

      const apiBase = getApiBaseUrl();
      const headers = { Authorization: `Bearer ${session.access_token}` };

      // 1. Fetch user profile & telegram status
      const meRes = await fetch(`${apiBase}/api/v1/auth/me`, { headers });
      if (meRes.ok) {
        const meData = await meRes.json();
        setProfile(meData);
      }

      // 2. Fetch targets & active slots
      const targetsRes = await fetch(`${apiBase}/api/v1/targets`, { headers });
      if (targetsRes.ok) {
        const targetsData = await targetsRes.json();
        setTargets(targetsData.targets || []);
      }

      // 3. Fetch recent notification history
      const notifRes = await fetch(`${apiBase}/api/v1/notifications/history`, { headers });
      if (notifRes.ok) {
        const notifData = await notifRes.json();
        setNotifications(notifData.notifications || []);
      }
    } catch (err: unknown) {
      setErrorMsg((err as Error).message || "Failed to load dashboard data");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 15000); // 15s refresh
    return () => clearInterval(interval);
  }, []);

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  };

  const handleGenerateTelegramLink = async () => {
    setLinkingLoading(true);
    setLinkingLink(null);
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const apiBase = getApiBaseUrl();
      const res = await fetch(`${apiBase}/api/v1/telegram/link-token`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setLinkingLink(data.deepLink);
      }
    } catch (err: unknown) {
      setErrorMsg("Failed to generate linking token.");
    } finally {
      setLinkingLoading(false);
    }
  };

  const handleSendTestNotification = async () => {
    setTestSending(true);
    setTestSuccess(null);
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const apiBase = getApiBaseUrl();
      const res = await fetch(`${apiBase}/api/v1/notifications/test`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (res.ok) {
        setTestSuccess("Test message delivered to your Telegram!");
        fetchDashboardData();
      } else {
        const err = await res.json();
        setErrorMsg(err.message || "Could not send test alert.");
      }
    } catch {
      setErrorMsg("Test notification dispatch failed.");
    } finally {
      setTestSending(false);
    }
  };

  const handleUnlinkTelegram = async () => {
    if (!confirm("Are you sure you want to disconnect Telegram alerts?")) return;
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const apiBase = getApiBaseUrl();
      await fetch(`${apiBase}/api/v1/telegram/unlink`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      fetchDashboardData();
    } catch {
      setErrorMsg("Failed to unlink Telegram.");
    }
  };

  const handleCreateInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail) return;

    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const apiBase = getApiBaseUrl();
      const res = await fetch(`${apiBase}/api/v1/invitations`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: inviteEmail, role: "user" }),
      });

      if (res.ok) {
        const data = await res.json();
        setInviteLinkGenerated(data.inviteUrl);
        setInviteEmail("");
      }
    } catch {
      setErrorMsg("Failed to create invitation.");
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-900 text-white">
        <div className="flex items-center space-x-3">
          <RefreshCw className="w-5 h-5 animate-spin text-blue-500" />
          <span className="text-sm font-medium">Loading Exam Monitor...</span>
        </div>
      </div>
    );
  }

  const primaryTarget =
    (selectedTargetId ? targets.find((t) => t.id === selectedTargetId) : null) ||
    targets.find((t) => t.categoryCode === "4") ||
    targets[0] ||
    null;
  const targetState = primaryTarget?.state;
  const activeSlots = primaryTarget?.slots.filter((s) => s.isAvailable) || [];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Top Navigation */}
      <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur sticky top-0 z-10 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-600 rounded-lg text-white">
              <Gauge className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base font-bold text-white tracking-tight">Exam Monitor</h1>
              <p className="text-xs text-slate-400">High-Availability Driving Exam Monitor</p>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2 text-xs text-slate-300">
              <User className="w-4 h-4 text-slate-400" />
              <span>{profile?.user.email}</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-900/60 text-blue-300 border border-blue-700/50 uppercase">
                {profile?.user.role}
              </span>
            </div>

            <button
              onClick={handleLogout}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        {errorMsg && (
          <div className="p-4 bg-red-950/60 border border-red-800 text-red-200 rounded-xl text-sm flex items-center space-x-2">
            <ShieldAlert className="w-5 h-5 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {testSuccess && (
          <div className="p-4 bg-emerald-950/60 border border-emerald-800 text-emerald-200 rounded-xl text-sm flex items-center space-x-2">
            <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
            <span>{testSuccess}</span>
          </div>
        )}

        {/* Category Switcher Tabs */}
        {targets.length > 1 && (
          <div className="flex items-center space-x-3 bg-slate-900 border border-slate-800 p-1.5 rounded-2xl w-fit">
            <span className="text-xs font-semibold text-slate-400 px-3 uppercase tracking-wider">
              კატეგორია:
            </span>
            {targets.map((t) => {
              const isSelected = t.id === primaryTarget?.id;
              const isCat4 = t.categoryCode === "4";
              const label = isCat4 ? "🚗 ავტომატიკა (Category 4)" : "⚙️ მექანიკა (Category 3)";
              const activeCount = t.slots.filter((s) => s.isAvailable).length;

              return (
                <button
                  key={t.id}
                  onClick={() => setSelectedTargetId(t.id)}
                  className={`px-4 py-2 rounded-xl text-xs font-semibold transition flex items-center space-x-2 ${
                    isSelected
                      ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20"
                      : "text-slate-400 hover:text-white hover:bg-slate-800"
                  }`}
                >
                  <span>{label}</span>
                  {activeCount > 0 && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
                      {activeCount} ღია
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Top Status Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Card 1: Worker Status */}
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Worker Status</span>
            <div className="mt-2 flex items-center space-x-2">
              <span className={`inline-block w-3 h-3 rounded-full ${
                targetState?.state === "Running" ? "bg-emerald-500 animate-pulse" : "bg-amber-500"
              }`} />
              <span className="text-lg font-bold text-white">{targetState?.state || "Unknown"}</span>
            </div>
            <p className="mt-1 text-xs text-slate-400">
              {targetState?.consecutiveFailures ? `${targetState.consecutiveFailures} consecutive failures` : "Continuous active lease"}
            </p>
          </div>

          {/* Card 2: Current Availability */}
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Availability Status</span>
            <div className="mt-2 flex items-center space-x-2">
              <Zap className={`w-5 h-5 ${
                targetState?.lastStatus === "AVAILABLE" ? "text-emerald-400" : "text-slate-400"
              }`} />
              <span className={`text-lg font-bold ${
                targetState?.lastStatus === "AVAILABLE" ? "text-emerald-400" : "text-white"
              }`}>
                {targetState?.lastStatus || "UNKNOWN"}
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-400">
              {activeSlots.length} open slot{activeSlots.length === 1 ? "" : "s"} detected
            </p>
          </div>

          {/* Card 3: Check Latency */}
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Latency & Interval</span>
            <div className="mt-2 flex items-baseline space-x-2">
              <span className="text-lg font-bold text-white">{targetState?.lastLatencyMs ?? "--"} ms</span>
              <span className="text-xs text-slate-400">/ {primaryTarget?.pollIntervalSeconds ?? 60}s poll</span>
            </div>
            <p className="mt-1 text-xs text-slate-400">
              Last check: {targetState?.lastCheckedAt ? new Date(targetState.lastCheckedAt).toLocaleTimeString() : "Pending"}
            </p>
          </div>

          {/* Card 4: Telegram Alert Link */}
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Telegram Channel</span>
            <div className="mt-2 flex items-center space-x-2">
              {profile?.telegram.isLinked ? (
                <>
                  <Bell className="w-5 h-5 text-blue-400" />
                  <span className="text-lg font-bold text-blue-400">Connected</span>
                </>
              ) : (
                <>
                  <BellOff className="w-5 h-5 text-slate-500" />
                  <span className="text-lg font-bold text-slate-400">Not Linked</span>
                </>
              )}
            </div>
            <p className="mt-1 text-xs text-slate-400">
              {profile?.telegram.isLinked ? `@${profile.telegram.telegramUsername || "Linked User"}` : "Immediate alerts disabled"}
            </p>
          </div>
        </div>

        {/* Main Content 2-Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column (2 Cols): Available Slots & Target Info */}
          <div className="lg:col-span-2 space-y-6">
            {/* Detected Available Slots */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                  <Calendar className="w-5 h-5 text-blue-400" />
                  <h2 className="text-base font-bold text-white">Detected Exam Dates & Slots</h2>
                </div>
                <a
                  href={process.env.NEXT_PUBLIC_EXAM_BOOKING_URL || "https://exam-booking.sa.gov.ge/practical-exam"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center space-x-1.5 text-xs text-blue-400 hover:text-blue-300 font-medium"
                >
                  <span>Open Official Portal</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>

              {activeSlots.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {activeSlots.map((slot) => (
                    <div
                      key={slot.id}
                      className="p-4 bg-emerald-950/30 border border-emerald-800/60 rounded-xl flex items-center justify-between"
                    >
                      <div>
                        <span className="text-xs text-emerald-400 font-semibold tracking-wide uppercase">Open Date</span>
                        <div className="text-lg font-bold text-white">{slot.bookingDate}</div>
                      </div>
                      <span className="px-2.5 py-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full text-xs font-semibold">
                        Available Now
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center bg-slate-950/50 border border-slate-800/80 rounded-xl text-slate-400">
                  <Clock className="w-8 h-8 mx-auto text-slate-500 mb-2" />
                  <p className="text-sm font-medium text-slate-300">No Driving Exam Spots Currently Open</p>
                  <p className="text-xs text-slate-500 mt-1">
                    The background worker is polling continuously. You will receive an instant Telegram message as soon as a slot is detected.
                  </p>
                </div>
              )}
            </div>

            {/* Notification History Feed */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
              <h2 className="text-base font-bold text-white mb-4 flex items-center space-x-2">
                <Bell className="w-5 h-5 text-blue-400" />
                <span>Recent Alert Notifications</span>
              </h2>

              {notifications.length > 0 ? (
                <div className="divide-y divide-slate-800 overflow-hidden">
                  {notifications.map((notif) => (
                    <div key={notif.id} className="py-3 flex items-start justify-between">
                      <div className="space-y-0.5">
                        <p className="text-sm text-slate-200 font-medium line-clamp-1">{notif.messageText.split("\n")[0]}</p>
                        <p className="text-xs text-slate-500">
                          {new Date(notif.createdAt).toLocaleString()}
                        </p>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                        notif.status === "DELIVERED"
                          ? "bg-emerald-950 text-emerald-400 border border-emerald-800"
                          : "bg-amber-950 text-amber-400 border border-amber-800"
                      }`}>
                        {notif.status}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-500 italic">No alerts delivered yet.</p>
              )}
            </div>
          </div>

          {/* Right Column (1 Col): Telegram Control & Admin Settings */}
          <div className="space-y-6">
            {/* Telegram Account Pairing Panel */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
              <div className="flex items-center space-x-2">
                <Shield className="w-5 h-5 text-blue-400" />
                <h2 className="text-base font-bold text-white">Telegram Integration</h2>
              </div>

              {profile?.telegram.isLinked ? (
                <div className="space-y-3">
                  <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 text-xs text-slate-300">
                    <p><strong>Username:</strong> @{profile.telegram.telegramUsername || "Linked"}</p>
                    <p><strong>Notifications:</strong> {profile.telegram.isSubscribed ? "Active" : "Muted"}</p>
                  </div>

                  <div className="flex space-x-2">
                    <button
                      onClick={handleSendTestNotification}
                      disabled={testSending}
                      className="flex-1 py-2 px-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg text-xs font-semibold flex items-center justify-center space-x-1.5 transition"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>{testSending ? "Sending..." : "Send Test Alert"}</span>
                    </button>

                    <button
                      onClick={handleUnlinkTelegram}
                      className="p-2 bg-slate-800 hover:bg-red-950/60 hover:text-red-400 text-slate-400 rounded-lg transition"
                      title="Disconnect Telegram"
                    >
                      <Unlink className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs text-slate-400">
                    Connect your private Telegram chat to receive alerts when exam dates open up.
                  </p>

                  <button
                    onClick={handleGenerateTelegramLink}
                    disabled={linkingLoading}
                    className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg text-xs flex items-center justify-center space-x-2 transition"
                  >
                    <span>Connect Telegram</span>
                  </button>

                  {linkingLink && (
                    <div className="p-3 bg-slate-950 border border-blue-800/60 rounded-lg text-xs space-y-2">
                      <p className="text-blue-300 font-semibold">Single-Use Link Ready (Valid 10 mins):</p>
                      <a
                        href={linkingLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-block w-full py-2 text-center bg-blue-500 hover:bg-blue-400 text-white font-bold rounded"
                      >
                        Open Telegram Bot & Press Start
                      </a>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Admin Management Panel (Invite Second User) */}
            {profile?.user.role === "admin" && (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
                <div className="flex items-center space-x-2">
                  <User className="w-5 h-5 text-emerald-400" />
                  <h2 className="text-base font-bold text-white">Invite User (Second Account)</h2>
                </div>

                <p className="text-xs text-slate-400">
                  Generate an invitation link to authorize your friend on this hosted instance.
                </p>

                <form onSubmit={handleCreateInvite} className="space-y-2">
                  <input
                    type="email"
                    required
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="friend@example.com"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white text-xs placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                  <button
                    type="submit"
                    className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg text-xs transition"
                  >
                    Generate Invite Link
                  </button>
                </form>

                {inviteLinkGenerated && (
                  <div className="p-3 bg-emerald-950/60 border border-emerald-800 rounded-lg text-xs break-all">
                    <span className="font-semibold text-emerald-300">Invite URL:</span>
                    <p className="text-slate-200 mt-1 select-all">{inviteLinkGenerated}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
