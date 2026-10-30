import { Component, createSignal, For } from "solid-js";
import { User, Globe, Coins, Check } from "./icons";
import { COUNTRIES, getCurrencyByCountry } from "../utils/countries";
import { UserProfile } from "../types/finance";

interface OnboardingModalProps {
  onComplete: (profile: UserProfile) => void;
}

export const OnboardingModal: Component<OnboardingModalProps> = (props) => {
  const [name, setName] = createSignal("");
  const [selectedCountry, setSelectedCountry] = createSignal("India");
  const [customSymbol, setCustomSymbol] = createSignal("");

  // Detected currency
  const detectedCurrency = () => getCurrencyByCountry(selectedCountry()) || COUNTRIES[0];

  const activeSymbol = () => customSymbol().trim() || detectedCurrency().symbol;

  const handleSubmit = (e: Event) => {
    e.preventDefault();
    const curr = detectedCurrency();
    const profile: UserProfile = {
      name: name().trim() || "User",
      country: selectedCountry(),
      currencyCode: curr.currencyCode,
      currencySymbol: activeSymbol(),
    };
    props.onComplete(profile);
  };

  return (
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 select-none">
      <div class="bg-white rounded-2xl border border-card-border shadow-2xl max-w-lg w-full p-7 space-y-6 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div class="text-center space-y-2">
          <div class="w-12 h-12 rounded-2xl bg-primary-light text-primary flex items-center justify-center mx-auto shadow-xs">
            <Coins class="w-6 h-6" />
          </div>
          <h1 class="text-xl font-bold tracking-tight text-text-main">
            Welcome to Finly
          </h1>
          <p class="text-xs text-text-muted max-w-sm mx-auto">
            Let's personalize your workspace. Tell us your name and country to configure your local currency.
          </p>
        </div>

        <form onSubmit={handleSubmit} class="space-y-5">
          {/* User Name Field */}
          <div>
            <label class="block text-[11px] font-bold text-text-muted uppercase tracking-wider mb-1.5">
              Your Name
            </label>
            <div class="relative">
              <User class="w-4 h-4 text-text-subtle absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                required
                placeholder="e.g. John Doe"
                value={name()}
                onInput={(e) => setName(e.currentTarget.value)}
                class="w-full bg-white border border-card-border rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-text-main placeholder:text-text-subtle focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition"
              />
            </div>
          </div>

          {/* Country Selection */}
          <div>
            <label class="block text-[11px] font-bold text-text-muted uppercase tracking-wider mb-1.5">
              Select Your Country
            </label>
            <div class="relative">
              <Globe class="w-4 h-4 text-text-subtle absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <select
                value={selectedCountry()}
                onChange={(e) => {
                  setSelectedCountry(e.currentTarget.value);
                  setCustomSymbol(""); // reset custom override when country changes
                }}
                class="w-full bg-white border border-card-border rounded-xl pl-10 pr-4 py-2.5 text-xs font-medium text-text-main focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition cursor-pointer"
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

          {/* Automatically Detected Currency Card */}
          <div class="bg-indigo-50/50 border border-indigo-100 rounded-2xl p-4 space-y-2">
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

          {/* Action Button */}
          <div class="pt-2">
            <button
              type="submit"
              class="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary-hover active:bg-primary-active text-white text-xs font-semibold py-3 px-4 rounded-xl transition shadow-xs cursor-pointer"
            >
              <span>Get Started</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
