import { Component, createSignal, For } from "solid-js";
import { X, User, Globe, Coins, Check, Sun, Moon, Monitor } from "./icons";
import { COUNTRIES, getCurrencyByCountry } from "../utils/countries";
import { ThemeMode, UserProfile } from "../types/finance";
import { applyTheme } from "../utils/theme";

interface SettingsModalProps {
  currentProfile: UserProfile | null;
  currentTheme: ThemeMode;
  onClose: () => void;
  onSave: (profile: UserProfile, theme: ThemeMode) => void;
}

export const SettingsModal: Component<SettingsModalProps> = (props) => {
  const [name, setName] = createSignal(props.currentProfile?.name || "");
  const [selectedCountry, setSelectedCountry] = createSignal(
    props.currentProfile?.country || "India"
  );
  const [customSymbol, setCustomSymbol] = createSignal(
    props.currentProfile?.currencySymbol || ""
  );
  const [selectedTheme, setSelectedTheme] = createSignal<ThemeMode>(
    props.currentTheme || "auto"
  );

  const detectedCurrency = () =>
    getCurrencyByCountry(selectedCountry()) || COUNTRIES[0];

  const activeSymbol = () =>
    customSymbol().trim() || detectedCurrency().symbol;

  const handleSelectTheme = (mode: ThemeMode) => {
    setSelectedTheme(mode);
    applyTheme(mode); // Immediate live preview!
  };

  const handleClose = () => {
    // Revert to original theme if cancelled
    applyTheme(props.currentTheme);
    props.onClose();
  };

  const handleSubmit = (e: Event) => {
    e.preventDefault();
    const curr = detectedCurrency();
    const updated: UserProfile = {
      name: name().trim() || "User",
      country: selectedCountry(),
      currencyCode: curr.currencyCode,
      currencySymbol: activeSymbol(),
      theme: selectedTheme(),
    };
    props.onSave(updated, selectedTheme());
    props.onClose();
  };

  const themeOptions: { mode: ThemeMode; label: string; icon: any }[] = [
    { mode: "light", label: "Light", icon: Sun },
    { mode: "dark", label: "Dark", icon: Moon },
    { mode: "auto", label: "System", icon: Monitor },
  ];

  return (
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 select-none">
      <div class="bg-card rounded-2xl border border-card-border shadow-2xl max-w-md w-full p-6 space-y-5 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div class="flex items-center justify-between border-b border-card-border pb-3">
          <div>
            <h2 class="text-base font-bold text-text-main">Settings</h2>
            <p class="text-xs text-text-muted mt-0.5">
              Personalize theme, profile, and regional currency
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            class="p-1 rounded-lg text-text-subtle hover:text-text-main hover:bg-card-subtle cursor-pointer transition-colors"
          >
            <X class="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} class="space-y-4">
          {/* Theme Mode Selection */}
          <div>
            <label class="block text-[11px] font-bold text-text-muted uppercase tracking-wider mb-2">
              Appearance & Theme
            </label>
            <div class="grid grid-cols-3 gap-2">
              <For each={themeOptions}>
                {(opt) => {
                  const Icon = opt.icon;
                  const isSelected = () => selectedTheme() === opt.mode;
                  return (
                    <button
                      type="button"
                      onClick={() => handleSelectTheme(opt.mode)}
                      class={`flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                        isSelected()
                          ? "border-primary bg-primary-light text-primary ring-1 ring-primary shadow-xs"
                          : "border-card-border bg-card text-text-muted hover:text-text-main hover:bg-card-subtle"
                      }`}
                    >
                      <Icon class="w-4 h-4" />
                      <span>{opt.label}</span>
                    </button>
                  );
                }}
              </For>
            </div>
          </div>

          {/* User Name */}
          <div>
            <label class="block text-[11px] font-bold text-text-muted uppercase tracking-wider mb-1">
              Username
            </label>
            <div class="relative">
              <User class="w-4 h-4 text-text-subtle absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                required
                placeholder="Enter your name..."
                value={name()}
                onInput={(e) => setName(e.currentTarget.value)}
                class="w-full bg-card border border-card-border rounded-xl pl-10 pr-3.5 py-2 text-xs text-text-main placeholder:text-text-subtle focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition"
              />
            </div>
          </div>

          {/* Country Selection */}
          <div>
            <label class="block text-[11px] font-bold text-text-muted uppercase tracking-wider mb-1">
              Country
            </label>
            <div class="relative">
              <Globe class="w-4 h-4 text-text-subtle absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <select
                value={selectedCountry()}
                onChange={(e) => {
                  setSelectedCountry(e.currentTarget.value);
                  const matched = getCurrencyByCountry(e.currentTarget.value);
                  if (matched) {
                    setCustomSymbol(matched.symbol);
                  }
                }}
                class="w-full bg-card border border-card-border rounded-xl pl-10 pr-9 py-2 text-xs font-medium text-text-main focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition cursor-pointer appearance-none"
              >
                <For each={COUNTRIES}>
                  {(c) => (
                    <option value={c.country} class="bg-card text-text-main">
                      {c.country} ({c.currencyCode} · {c.symbol})
                    </option>
                  )}
                </For>
              </select>
            </div>
          </div>

          {/* Detected Currency Card */}
          <div class="bg-primary-light border border-primary/20 rounded-xl p-3.5 space-y-1.5">
            <div class="flex items-center justify-between">
              <span class="text-[11px] font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
                <Check class="w-3.5 h-3.5" />
                Detected Currency
              </span>
              <span class="text-xs font-bold text-primary bg-card px-2 py-0.5 rounded-md border border-primary/20 shadow-2xs">
                {detectedCurrency().currencyCode} ({activeSymbol()})
              </span>
            </div>

            <div class="text-xs text-text-main flex items-center justify-between pt-1">
              <span class="text-text-muted">{detectedCurrency().currencyName}</span>
              <span class="font-mono font-semibold">
                Sample: {activeSymbol()}2,450.00
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div class="flex items-center justify-end gap-2.5 pt-3 border-t border-card-border">
            <button
              type="button"
              onClick={handleClose}
              class="px-4 py-2 rounded-xl text-xs font-semibold text-text-muted hover:text-text-main hover:bg-card-subtle transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              class="px-5 py-2 rounded-xl text-xs font-semibold bg-primary hover:bg-primary-hover active:bg-primary-active text-white transition shadow-xs cursor-pointer"
            >
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
