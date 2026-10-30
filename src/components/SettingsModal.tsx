import { Component, createSignal, For } from "solid-js";
import { X, User, Globe, Coins, Check } from "./icons";
import { COUNTRIES, getCurrencyByCountry } from "../utils/countries";
import { UserProfile } from "../types/finance";

interface SettingsModalProps {
  currentProfile: UserProfile | null;
  onClose: () => void;
  onSave: (profile: UserProfile) => void;
}

export const SettingsModal: Component<SettingsModalProps> = (props) => {
  const [name, setName] = createSignal(props.currentProfile?.name || "");
  const [selectedCountry, setSelectedCountry] = createSignal(
    props.currentProfile?.country || "India"
  );
  const [customSymbol, setCustomSymbol] = createSignal(
    props.currentProfile?.currencySymbol || ""
  );

  const detectedCurrency = () =>
    getCurrencyByCountry(selectedCountry()) || COUNTRIES[0];

  const activeSymbol = () =>
    customSymbol().trim() || detectedCurrency().symbol;

  const handleSubmit = (e: Event) => {
    e.preventDefault();
    const curr = detectedCurrency();
    const updated: UserProfile = {
      name: name().trim() || "User",
      country: selectedCountry(),
      currencyCode: curr.currencyCode,
      currencySymbol: activeSymbol(),
    };
    props.onSave(updated);
    props.onClose();
  };

  return (
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 select-none">
      <div class="bg-white rounded-2xl border border-card-border shadow-2xl max-w-md w-full p-6 space-y-5 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div class="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h2 class="text-base font-bold text-text-main">Settings</h2>
            <p class="text-xs text-text-muted mt-0.5">
              Update your username, country, and currency format
            </p>
          </div>
          <button
            type="button"
            onClick={props.onClose}
            class="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
          >
            <X class="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} class="space-y-4">
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
                class="w-full bg-white border border-card-border rounded-xl pl-10 pr-3.5 py-2 text-xs text-text-main placeholder:text-text-subtle focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition"
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
                class="w-full bg-white border border-card-border rounded-xl pl-10 pr-4 py-2 text-xs font-medium text-text-main focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition cursor-pointer"
              >
                <For each={COUNTRIES}>
                  {(c) => (
                    <option value={c.country}>
                      {c.country} ({c.currencyCode} · {c.symbol})
                    </option>
                  )}
                </For>
              </select>
            </div>
          </div>

          {/* Detected Currency Card */}
          <div class="bg-indigo-50/50 border border-indigo-100 rounded-xl p-3.5 space-y-1.5">
            <div class="flex items-center justify-between">
              <span class="text-[11px] font-bold uppercase tracking-wider text-[#5842e3] flex items-center gap-1.5">
                <Check class="w-3.5 h-3.5" />
                Detected Currency
              </span>
              <span class="text-xs font-bold text-[#5842e3] bg-white px-2 py-0.5 rounded-md border border-indigo-100 shadow-2xs">
                {detectedCurrency().currencyCode} ({activeSymbol()})
              </span>
            </div>

            <div class="text-xs text-slate-700 flex items-center justify-between pt-1">
              <span>{detectedCurrency().currencyName}</span>
              <span class="font-mono font-semibold text-slate-900">
                Sample: {activeSymbol()}2,450.00
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div class="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={props.onClose}
              class="px-4 py-2 rounded-xl text-xs font-semibold text-text-muted hover:text-text-main hover:bg-slate-100 transition cursor-pointer"
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
