import { Component, createSignal, onMount, For, Show } from "solid-js";
import {
  Sparkles,
  TrendingUp,
  CircleAlert,
  Lightbulb,
  RefreshCw,
  ArrowRight,
  ChevronDown,
} from "./icons";
import {
  DigestDataInput,
  FinancialHealthDigest,
  computeLocalHealthDigest,
  generateAIFinancialDigest,
  getCachedHealthDigest,
} from "../utils/ai/financialDigest";
import { getAIConfig } from "../utils/ai/storage";
import { AIConfig, DEFAULT_AI_CONFIG } from "../utils/ai/types";

interface DashboardHealthDigestProps extends DigestDataInput {
  isAiEnabled?: boolean;
  onNavigateToCategory?: (category: string) => void;
  onOpenAskFinly?: (prompt?: string) => void;
}

export const DashboardHealthDigest: Component<DashboardHealthDigestProps> = (props) => {
  const symbol = () => props.currencySymbol || "$";
  const [digest, setDigest] = createSignal<FinancialHealthDigest>(computeLocalHealthDigest(props));
  const [isGenerating, setIsGenerating] = createSignal(false);
  const [isCollapsed, setIsCollapsed] = createSignal(false);
  const [aiConfig, setAiConfig] = createSignal<AIConfig>(DEFAULT_AI_CONFIG);

  onMount(async () => {
    // 1. Initial instant calculation
    const local = computeLocalHealthDigest(props);
    const cached = getCachedHealthDigest();

    if (cached) {
      setDigest(cached);
    } else {
      setDigest(local);
    }

    // 2. Fetch AI config
    try {
      const cfg = await getAIConfig();
      setAiConfig(cfg);

      // If AI is enabled and no cached digest exists yet, generate AI digest in background
      if (cfg.enabled && !cached && props.transactions.length > 0) {
        setIsGenerating(true);
        generateAIFinancialDigest(props, cfg)
          .then((aiDigest) => {
            setDigest(aiDigest);
          })
          .catch(() => {})
          .finally(() => {
            setIsGenerating(false);
          });
      }
    } catch {
      // ignore
    }
  });

  const handleRefresh = async () => {
    if (isGenerating()) return;
    setIsGenerating(true);
    try {
      const cfg = await getAIConfig();
      setAiConfig(cfg);
      const updated = await generateAIFinancialDigest(props, cfg);
      setDigest(updated);
    } catch (err) {
      console.warn("Digest refresh error:", err);
      setDigest(computeLocalHealthDigest(props));
    } finally {
      setIsGenerating(false);
    }
  };

  const getScoreColor = (rating: string) => {
    switch (rating) {
      case "Excellent":
        return "text-emerald-400 bg-emerald-500/10 border-emerald-500/20";
      case "Strong":
        return "text-cyan-400 bg-cyan-500/10 border-cyan-500/20";
      case "Fair":
        return "text-amber-400 bg-amber-500/10 border-amber-500/20";
      default:
        return "text-rose-400 bg-rose-500/10 border-rose-500/20";
    }
  };

  const getSeverityBadge = (severity: "high" | "medium" | "low") => {
    switch (severity) {
      case "high":
        return "bg-rose-500/15 text-rose-400 border-rose-500/25";
      case "medium":
        return "bg-amber-500/15 text-amber-400 border-amber-500/25";
      default:
        return "bg-card-subtle text-text-muted border-card-border";
    }
  };

  return (
    <div class="relative overflow-hidden bg-card rounded-2xl border border-card-border shadow-xs transition-all duration-300">
      {/* Top Gradient Accent */}
      <div class="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-cyan-400 to-indigo-600" />

      {/* Header Bar */}
      <div class="flex items-center justify-between p-4 sm:p-5 border-b border-card-border/60">
        <div class="flex flex-wrap items-center gap-3">
          <div class="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-cyan-500 p-0.5 flex items-center justify-center text-white shadow-xs">
            <Sparkles class="w-4 h-4 animate-pulse" />
          </div>

          <div>
            <div class="flex items-center gap-2">
              <h2 class="text-sm font-bold text-text-main flex items-center gap-1.5">
                Financial Health Digest
              </h2>
              {/* Health Score Badge */}
              <span
                class={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border ${getScoreColor(
                  digest().healthRating
                )}`}
              >
                <span>{digest().healthScore}/100</span>
                <span class="text-[10px] font-semibold opacity-90">• {digest().healthRating}</span>
              </span>
            </div>
            <p class="text-[11px] text-text-muted mt-0.5">
              {aiConfig().enabled
                ? `Synthesized with ${aiConfig().provider.toUpperCase()} • Monthly velocity, budget risks & savings`
                : "Automated monthly velocity, budget risk analysis, and actionable savings"}
            </p>
          </div>
        </div>

        <div class="flex items-center gap-2">
          {/* Refresh Digest Button */}
          <button
            type="button"
            disabled={isGenerating()}
            onClick={handleRefresh}
            title="Refresh Financial Health Digest"
            class="inline-flex items-center gap-1.5 text-xs text-text-muted hover:text-text-main bg-card-subtle hover:bg-card border border-card-border px-3 py-1.5 rounded-xl transition cursor-pointer disabled:opacity-50"
          >
            <RefreshCw class={`w-3.5 h-3.5 ${isGenerating() ? "animate-spin text-primary" : ""}`} />
            <span class="hidden sm:inline">
              {isGenerating() ? "Analyzing..." : "Refresh"}
            </span>
          </button>

          {/* Ask Finly Shortcut */}
          <Show when={props.onOpenAskFinly}>
            <button
              type="button"
              onClick={() => props.onOpenAskFinly?.("Provide a full breakdown of my financial health digest.")}
              class="inline-flex items-center gap-1 text-xs text-primary hover:text-primary-hover bg-primary/10 hover:bg-primary/15 border border-primary/20 px-3 py-1.5 rounded-xl font-semibold transition cursor-pointer"
            >
              <span>Ask Finly</span>
              <ArrowRight class="w-3 h-3" />
            </button>
          </Show>

          {/* Collapse / Expand Toggle */}
          <button
            type="button"
            onClick={() => setIsCollapsed(!isCollapsed())}
            class="p-1.5 rounded-lg text-text-subtle hover:text-text-main hover:bg-card-subtle transition cursor-pointer"
            aria-label={isCollapsed() ? "Expand digest" : "Collapse digest"}
          >
            <ChevronDown
              class={`w-4 h-4 transition-transform duration-200 ${
                isCollapsed() ? "-rotate-90" : "rotate-0"
              }`}
            />
          </button>
        </div>
      </div>

      {/* Collapsible Content */}
      <Show when={!isCollapsed()}>
        <div class="p-4 sm:p-5 space-y-4">
          {/* Executive Summary Banner */}
          <div class="p-3.5 rounded-xl bg-card-subtle border border-card-border/70 flex items-start gap-3">
            <div class="p-1.5 rounded-lg bg-primary/10 text-primary shrink-0 mt-0.5">
              <Sparkles class="w-4 h-4" />
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-xs font-medium text-text-main leading-relaxed">
                {digest().healthSummary}
              </p>
            </div>
          </div>

          {/* 3-Pillar Insights Grid */}
          <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* PILLAR 1: Monthly Trend & Cash Flow */}
            <div class="bg-card-subtle/50 rounded-xl border border-card-border p-4 flex flex-col justify-between space-y-3">
              <div>
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-2">
                    <span class="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400">
                      <TrendingUp class="w-4 h-4" />
                    </span>
                    <h3 class="text-xs font-bold text-text-main">Monthly Trend</h3>
                  </div>

                  {/* MoM Badge */}
                  <span
                    class={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      digest().trendAnalysis.momChangePct <= 0
                        ? "bg-emerald-500/15 text-emerald-400"
                        : "bg-rose-500/15 text-rose-400"
                    }`}
                  >
                    {digest().trendAnalysis.momChangePct <= 0 ? "" : "+"}
                    {digest().trendAnalysis.momChangePct}% MoM
                  </span>
                </div>

                <p class="text-xs text-text-muted mt-2.5 leading-relaxed">
                  {digest().trendAnalysis.narrative}
                </p>
              </div>

              {/* Monthly Stats Strip */}
              <div class="grid grid-cols-2 gap-2 pt-2 border-t border-card-border/60">
                <div>
                  <div class="text-[10px] text-text-muted">Net Cash Flow</div>
                  <div
                    class={`text-xs font-bold mt-0.5 ${
                      digest().trendAnalysis.netCashFlow >= 0 ? "text-primary" : "text-rose-500"
                    }`}
                  >
                    {digest().trendAnalysis.netCashFlow >= 0 ? "+" : "-"}
                    {symbol()}
                    {Math.abs(digest().trendAnalysis.netCashFlow).toLocaleString("en-US", {
                      maximumFractionDigits: 0,
                    })}
                  </div>
                </div>

                <div>
                  <div class="text-[10px] text-text-muted">Savings Rate</div>
                  <div class="text-xs font-bold text-primary mt-0.5">
                    {digest().trendAnalysis.savingsRate}%
                  </div>
                </div>
              </div>
            </div>

            {/* PILLAR 2: Budget & Spending Anomalies */}
            <div class="bg-card-subtle/50 rounded-xl border border-card-border p-4 flex flex-col justify-between space-y-3">
              <div>
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-2">
                    <span class="p-1.5 rounded-lg bg-amber-500/10 text-amber-400">
                      <CircleAlert class="w-4 h-4" />
                    </span>
                    <h3 class="text-xs font-bold text-text-main">Budget & Risk Anomalies</h3>
                  </div>

                  <span class="text-[10px] font-semibold text-text-muted">
                    {digest().anomalies.length} Flagged
                  </span>
                </div>

                <div class="space-y-2 mt-2.5">
                  <For
                    each={digest().anomalies}
                    fallback={
                      <div class="py-4 text-center text-text-muted text-xs">
                        No budget anomalies detected this month.
                      </div>
                    }
                  >
                    {(anomaly) => (
                      <div class="p-2 rounded-lg bg-card border border-card-border/70 text-xs space-y-1">
                        <div class="flex items-center justify-between gap-1">
                          <span class="font-semibold text-text-main truncate">
                            {anomaly.title}
                          </span>
                          <span
                            class={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded border ${getSeverityBadge(
                              anomaly.severity
                            )}`}
                          >
                            {anomaly.severity}
                          </span>
                        </div>
                        <p class="text-[11px] text-text-muted leading-tight">
                          {anomaly.description}
                        </p>
                        <Show when={anomaly.category && props.onNavigateToCategory}>
                          <button
                            type="button"
                            onClick={() => props.onNavigateToCategory?.(anomaly.category!)}
                            class="text-[10px] font-semibold text-primary hover:underline pt-0.5 cursor-pointer block"
                          >
                            Review {anomaly.category} transactions →
                          </button>
                        </Show>
                      </div>
                    )}
                  </For>
                </div>
              </div>
            </div>

            {/* PILLAR 3: Actionable Savings Opportunities */}
            <div class="bg-card-subtle/50 rounded-xl border border-card-border p-4 flex flex-col justify-between space-y-3">
              <div>
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-2">
                    <span class="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400">
                      <Lightbulb class="w-4 h-4" />
                    </span>
                    <h3 class="text-xs font-bold text-text-main">Savings Opportunities</h3>
                  </div>

                  <span class="text-[10px] font-bold text-emerald-500">
                    Actionable
                  </span>
                </div>

                <div class="space-y-2 mt-2.5">
                  <For
                    each={digest().savingsSuggestions}
                    fallback={
                      <div class="py-4 text-center text-text-muted text-xs">
                        Keep up your budget consistency!
                      </div>
                    }
                  >
                    {(suggestion) => (
                      <div class="p-2.5 rounded-lg bg-card border border-card-border/70 text-xs space-y-1.5">
                        <div class="flex items-center justify-between gap-1">
                          <span class="font-semibold text-text-main truncate">
                            {suggestion.title}
                          </span>
                          <span class="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded">
                            +{symbol()}{suggestion.estimatedMonthlySavings}/mo
                          </span>
                        </div>
                        <p class="text-[11px] text-text-muted leading-relaxed">
                          {suggestion.description}
                        </p>
                        <Show when={suggestion.actionPrompt && props.onOpenAskFinly}>
                          <button
                            type="button"
                            onClick={() => props.onOpenAskFinly?.(suggestion.actionPrompt)}
                            class="text-[10px] font-semibold text-primary hover:underline pt-0.5 cursor-pointer inline-flex items-center gap-1"
                          >
                            <span>Ask Finly to optimize</span>
                            <ArrowRight class="w-2.5 h-2.5" />
                          </button>
                        </Show>
                      </div>
                    )}
                  </For>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Show>
    </div>
  );
};
