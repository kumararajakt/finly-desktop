export interface CountryCurrency {
  country: string;
  code: string;
  currencyCode: string;
  currencyName: string;
  symbol: string;
}

export const COUNTRIES: CountryCurrency[] = [
  { country: "India", code: "IN", currencyCode: "INR", currencyName: "Indian Rupee", symbol: "₹" },
  { country: "United States", code: "US", currencyCode: "USD", currencyName: "US Dollar", symbol: "$" },
  { country: "United Kingdom", code: "GB", currencyCode: "GBP", currencyName: "British Pound", symbol: "£" },
  { country: "European Union / Germany", code: "DE", currencyCode: "EUR", currencyName: "Euro", symbol: "€" },
  { country: "Canada", code: "CA", currencyCode: "CAD", currencyName: "Canadian Dollar", symbol: "CA$" },
  { country: "Australia", code: "AU", currencyCode: "AUD", currencyName: "Australian Dollar", symbol: "A$" },
  { country: "Japan", code: "JP", currencyCode: "JPY", currencyName: "Japanese Yen", symbol: "¥" },
  { country: "Singapore", code: "SG", currencyCode: "SGD", currencyName: "Singapore Dollar", symbol: "S$" },
  { country: "United Arab Emirates", code: "AE", currencyCode: "AED", currencyName: "UAE Dirham", symbol: "AED" },
  { country: "Switzerland", code: "CH", currencyCode: "CHF", currencyName: "Swiss Franc", symbol: "CHF" },
  { country: "China", code: "CN", currencyCode: "CNY", currencyName: "Chinese Yuan", symbol: "¥" },
  { country: "Brazil", code: "BR", currencyCode: "BRL", currencyName: "Brazilian Real", symbol: "R$" },
  { country: "South Africa", code: "ZA", currencyCode: "ZAR", currencyName: "South African Rand", symbol: "R" },
  { country: "New Zealand", code: "NZ", currencyCode: "NZD", currencyName: "New Zealand Dollar", symbol: "NZ$" },
  { country: "Mexico", code: "MX", currencyCode: "MXN", currencyName: "Mexican Peso", symbol: "Mex$" },
  { country: "Indonesia", code: "ID", currencyCode: "IDR", currencyName: "Indonesian Rupiah", symbol: "Rp" },
  { country: "Malaysia", code: "MY", currencyCode: "MYR", currencyName: "Malaysian Ringgit", symbol: "RM" },
  { country: "Philippines", code: "PH", currencyCode: "PHP", currencyName: "Philippine Peso", symbol: "₱" },
  { country: "Saudi Arabia", code: "SA", currencyCode: "SAR", currencyName: "Saudi Riyal", symbol: "SAR" },
  { country: "South Korea", code: "KR", currencyCode: "KRW", currencyName: "South Korean Won", symbol: "₩" },
  { country: "Turkey", code: "TR", currencyCode: "TRY", currencyName: "Turkish Lira", symbol: "₺" },
  { country: "Vietnam", code: "VN", currencyCode: "VND", currencyName: "Vietnamese Dong", symbol: "₫" },
  { country: "Sweden", code: "SE", currencyCode: "SEK", currencyName: "Swedish Krona", symbol: "kr" },
  { country: "Norway", code: "NO", currencyCode: "NOK", currencyName: "Norwegian Krone", symbol: "kr" },
  { country: "Denmark", code: "DK", currencyCode: "DKK", currencyName: "Danish Krone", symbol: "kr" },
  { country: "Poland", code: "PL", currencyCode: "PLN", currencyName: "Polish Zloty", symbol: "zł" },
  { country: "Thailand", code: "TH", currencyCode: "THB", currencyName: "Thai Baht", symbol: "฿" },
  { country: "Nigeria", code: "NG", currencyCode: "NGN", currencyName: "Nigerian Naira", symbol: "₦" },
  { country: "Kenya", code: "KE", currencyCode: "KES", currencyName: "Kenyan Shilling", symbol: "KSh" },
  { country: "Egypt", code: "EG", currencyCode: "EGP", currencyName: "Egyptian Pound", symbol: "E£" },
  { country: "Argentina", code: "AR", currencyCode: "ARS", currencyName: "Argentine Peso", symbol: "ARS$" },
  { country: "Chile", code: "CL", currencyCode: "CLP", currencyName: "Chilean Peso", symbol: "CLP$" },
  { country: "Colombia", code: "CO", currencyCode: "COP", currencyName: "Colombian Peso", symbol: "COL$" },
  { country: "Pakistan", code: "PK", currencyCode: "PKR", currencyName: "Pakistani Rupee", symbol: "Rs" },
  { country: "Bangladesh", code: "BD", currencyCode: "BDT", currencyName: "Bangladeshi Taka", symbol: "৳" },
  { country: "Sri Lanka", code: "LK", currencyCode: "LKR", currencyName: "Sri Lankan Rupee", symbol: "Rs" },
  { country: "Nepal", code: "NP", currencyCode: "NPR", currencyName: "Nepalese Rupee", symbol: "Rs" },
];

export function getCurrencyByCountry(countryName: string): CountryCurrency | undefined {
  return COUNTRIES.find((c) => c.country.toLowerCase() === countryName.toLowerCase());
}
