#include "SettingsManager.h"

#include <QJsonDocument>
#include <QJsonObject>

namespace Finly {

const QVector<CountryCurrency> &SettingsManager::allCountries()
{
    static const QVector<CountryCurrency> s_countries = {
        {QStringLiteral("India"), QStringLiteral("IN"), QStringLiteral("INR"), QStringLiteral("Indian Rupee"), QStringLiteral("₹")},
        {QStringLiteral("United States"), QStringLiteral("US"), QStringLiteral("USD"), QStringLiteral("US Dollar"), QStringLiteral("$")},
        {QStringLiteral("United Kingdom"), QStringLiteral("GB"), QStringLiteral("GBP"), QStringLiteral("British Pound"), QStringLiteral("£")},
        {QStringLiteral("European Union / Germany"), QStringLiteral("DE"), QStringLiteral("EUR"), QStringLiteral("Euro"), QStringLiteral("€")},
        {QStringLiteral("Canada"), QStringLiteral("CA"), QStringLiteral("CAD"), QStringLiteral("Canadian Dollar"), QStringLiteral("CA$")},
        {QStringLiteral("Australia"), QStringLiteral("AU"), QStringLiteral("AUD"), QStringLiteral("Australian Dollar"), QStringLiteral("A$")},
        {QStringLiteral("Japan"), QStringLiteral("JP"), QStringLiteral("JPY"), QStringLiteral("Japanese Yen"), QStringLiteral("¥")},
        {QStringLiteral("Singapore"), QStringLiteral("SG"), QStringLiteral("SGD"), QStringLiteral("Singapore Dollar"), QStringLiteral("S$")},
        {QStringLiteral("United Arab Emirates"), QStringLiteral("AE"), QStringLiteral("AED"), QStringLiteral("UAE Dirham"), QStringLiteral("AED")},
        {QStringLiteral("Switzerland"), QStringLiteral("CH"), QStringLiteral("CHF"), QStringLiteral("Swiss Franc"), QStringLiteral("CHF")},
        {QStringLiteral("China"), QStringLiteral("CN"), QStringLiteral("CNY"), QStringLiteral("Chinese Yuan"), QStringLiteral("¥")},
        {QStringLiteral("Brazil"), QStringLiteral("BR"), QStringLiteral("BRL"), QStringLiteral("Brazilian Real"), QStringLiteral("R$")},
        {QStringLiteral("South Africa"), QStringLiteral("ZA"), QStringLiteral("ZAR"), QStringLiteral("South African Rand"), QStringLiteral("R")},
        {QStringLiteral("New Zealand"), QStringLiteral("NZ"), QStringLiteral("NZD"), QStringLiteral("New Zealand Dollar"), QStringLiteral("NZ$")},
        {QStringLiteral("Mexico"), QStringLiteral("MX"), QStringLiteral("MXN"), QStringLiteral("Mexican Peso"), QStringLiteral("Mex$")},
        {QStringLiteral("Indonesia"), QStringLiteral("ID"), QStringLiteral("IDR"), QStringLiteral("Indonesian Rupiah"), QStringLiteral("Rp")},
        {QStringLiteral("Malaysia"), QStringLiteral("MY"), QStringLiteral("MYR"), QStringLiteral("Malaysian Ringgit"), QStringLiteral("RM")},
        {QStringLiteral("Philippines"), QStringLiteral("PH"), QStringLiteral("PHP"), QStringLiteral("Philippine Peso"), QStringLiteral("₱")},
        {QStringLiteral("Saudi Arabia"), QStringLiteral("SA"), QStringLiteral("SAR"), QStringLiteral("Saudi Riyal"), QStringLiteral("SAR")},
        {QStringLiteral("South Korea"), QStringLiteral("KR"), QStringLiteral("KRW"), QStringLiteral("South Korean Won"), QStringLiteral("₩")},
        {QStringLiteral("Turkey"), QStringLiteral("TR"), QStringLiteral("TRY"), QStringLiteral("Turkish Lira"), QStringLiteral("₺")},
        {QStringLiteral("Vietnam"), QStringLiteral("VN"), QStringLiteral("VND"), QStringLiteral("Vietnamese Dong"), QStringLiteral("₫")},
        {QStringLiteral("Sweden"), QStringLiteral("SE"), QStringLiteral("SEK"), QStringLiteral("Swedish Krona"), QStringLiteral("kr")},
        {QStringLiteral("Norway"), QStringLiteral("NO"), QStringLiteral("NOK"), QStringLiteral("Norwegian Krone"), QStringLiteral("kr")},
        {QStringLiteral("Denmark"), QStringLiteral("DK"), QStringLiteral("DKK"), QStringLiteral("Danish Krone"), QStringLiteral("kr")},
        {QStringLiteral("Poland"), QStringLiteral("PL"), QStringLiteral("PLN"), QStringLiteral("Polish Zloty"), QStringLiteral("zł")},
        {QStringLiteral("Thailand"), QStringLiteral("TH"), QStringLiteral("THB"), QStringLiteral("Thai Baht"), QStringLiteral("฿")},
        {QStringLiteral("Nigeria"), QStringLiteral("NG"), QStringLiteral("NGN"), QStringLiteral("Nigerian Naira"), QStringLiteral("₦")},
        {QStringLiteral("Kenya"), QStringLiteral("KE"), QStringLiteral("KES"), QStringLiteral("Kenyan Shilling"), QStringLiteral("KSh")},
        {QStringLiteral("Egypt"), QStringLiteral("EG"), QStringLiteral("EGP"), QStringLiteral("Egyptian Pound"), QStringLiteral("E£")},
        {QStringLiteral("Argentina"), QStringLiteral("AR"), QStringLiteral("ARS"), QStringLiteral("Argentine Peso"), QStringLiteral("ARS$")},
        {QStringLiteral("Chile"), QStringLiteral("CL"), QStringLiteral("CLP"), QStringLiteral("Chilean Peso"), QStringLiteral("CLP$")},
        {QStringLiteral("Colombia"), QStringLiteral("CO"), QStringLiteral("COP"), QStringLiteral("Colombian Peso"), QStringLiteral("COL$")},
        {QStringLiteral("Pakistan"), QStringLiteral("PK"), QStringLiteral("PKR"), QStringLiteral("Pakistani Rupee"), QStringLiteral("Rs")},
        {QStringLiteral("Bangladesh"), QStringLiteral("BD"), QStringLiteral("BDT"), QStringLiteral("Bangladeshi Taka"), QStringLiteral("৳")},
        {QStringLiteral("Sri Lanka"), QStringLiteral("LK"), QStringLiteral("LKR"), QStringLiteral("Sri Lankan Rupee"), QStringLiteral("Rs")},
        {QStringLiteral("Nepal"), QStringLiteral("NP"), QStringLiteral("NPR"), QStringLiteral("Nepalese Rupee"), QStringLiteral("Rs")},
    };
    return s_countries;
}

SettingsManager::SettingsManager(DatabaseManager *db, QObject *parent)
    : QObject(parent)
    , m_db(db)
{
    m_profile.currencyCode = QStringLiteral("USD");
    m_profile.currencySymbol = QStringLiteral("$");
    m_profile.country = QStringLiteral("United States");
}

void SettingsManager::load()
{
    if (!m_db) {
        return;
    }

    if (const auto profileJson = m_db->getSetting(QStringLiteral("user_profile"))) {
        const QJsonObject obj = QJsonDocument::fromJson(profileJson->toUtf8()).object();
        if (!obj.isEmpty()) {
            m_profile.name = obj.value(QStringLiteral("name")).toString();
            m_profile.country = obj.value(QStringLiteral("country")).toString(QStringLiteral("India"));
            m_profile.currencyCode = obj.value(QStringLiteral("currencyCode")).toString(QStringLiteral("INR"));
            m_profile.currencySymbol = obj.value(QStringLiteral("currencySymbol")).toString(QStringLiteral("₹"));
            m_hasProfile = true;
            Q_EMIT profileChanged();
        }
    }

    if (const auto themeVal = m_db->getSetting(QStringLiteral("theme"))) {
        if (*themeVal == QStringLiteral("light") || *themeVal == QStringLiteral("dark") || *themeVal == QStringLiteral("auto")) {
            m_theme = *themeVal;
            Q_EMIT themeChanged();
        }
    }

    if (const auto aiJson = m_db->getSetting(QStringLiteral("ai_config"))) {
        const QJsonObject obj = QJsonDocument::fromJson(aiJson->toUtf8()).object();
        if (!obj.isEmpty()) {
            m_aiConfig.enabled = obj.value(QStringLiteral("enabled")).toBool(false);
            m_aiConfig.provider = obj.value(QStringLiteral("provider")).toString(QStringLiteral("ollama"));
            m_aiConfig.ollamaEndpoint = obj.value(QStringLiteral("ollamaEndpoint")).toString(QStringLiteral("http://localhost:11434"));
            m_aiConfig.ollamaModel = obj.value(QStringLiteral("ollamaModel")).toString(QStringLiteral("llama3.2"));
            m_aiConfig.geminiApiKey = obj.value(QStringLiteral("geminiApiKey")).toString();
            m_aiConfig.geminiModel = obj.value(QStringLiteral("geminiModel")).toString(QStringLiteral("gemini-1.5-flash"));
            m_aiConfig.openaiApiKey = obj.value(QStringLiteral("openaiApiKey")).toString();
            m_aiConfig.openaiModel = obj.value(QStringLiteral("openaiModel")).toString(QStringLiteral("gpt-4o-mini"));
            m_aiConfig.anthropicApiKey = obj.value(QStringLiteral("anthropicApiKey")).toString();
            m_aiConfig.anthropicModel = obj.value(QStringLiteral("anthropicModel")).toString(QStringLiteral("claude-3-5-haiku-20241022"));
            Q_EMIT aiConfigChanged();
        }
    }
}

bool SettingsManager::hasProfile() const { return m_hasProfile; }
QString SettingsManager::userName() const { return m_profile.name; }
QString SettingsManager::country() const { return m_profile.country; }
QString SettingsManager::currencyCode() const { return m_profile.currencyCode; }
QString SettingsManager::currencySymbol() const { return m_profile.currencySymbol; }
QString SettingsManager::theme() const { return m_theme; }

void SettingsManager::setTheme(const QString &mode)
{
    if (m_theme == mode) {
        return;
    }
    if (mode != QStringLiteral("light") && mode != QStringLiteral("dark") && mode != QStringLiteral("auto")) {
        return;
    }
    m_theme = mode;
    if (m_db) {
        m_db->setSetting(QStringLiteral("theme"), m_theme);
    }
    Q_EMIT themeChanged();
}

bool SettingsManager::aiEnabled() const { return m_aiConfig.enabled; }
QString SettingsManager::aiProvider() const { return m_aiConfig.provider; }
AIConfig SettingsManager::aiConfig() const { return m_aiConfig; }

QVariantMap SettingsManager::aiConfigMap() const
{
    return {
        {QStringLiteral("enabled"), m_aiConfig.enabled},
        {QStringLiteral("provider"), m_aiConfig.provider},
        {QStringLiteral("ollamaEndpoint"), m_aiConfig.ollamaEndpoint},
        {QStringLiteral("ollamaModel"), m_aiConfig.ollamaModel},
        {QStringLiteral("geminiApiKey"), m_aiConfig.geminiApiKey},
        {QStringLiteral("geminiModel"), m_aiConfig.geminiModel},
        {QStringLiteral("openaiApiKey"), m_aiConfig.openaiApiKey},
        {QStringLiteral("openaiModel"), m_aiConfig.openaiModel},
        {QStringLiteral("anthropicApiKey"), m_aiConfig.anthropicApiKey},
        {QStringLiteral("anthropicModel"), m_aiConfig.anthropicModel},
    };
}

QVariantList SettingsManager::countriesList() const
{
    QVariantList list;
    for (const auto &c : allCountries()) {
        list.append(QVariantMap{
            {QStringLiteral("country"), c.country},
            {QStringLiteral("code"), c.code},
            {QStringLiteral("currencyCode"), c.currencyCode},
            {QStringLiteral("currencyName"), c.currencyName},
            {QStringLiteral("symbol"), c.symbol},
        });
    }
    return list;
}

void SettingsManager::saveProfile(const QString &name, const QString &country, const QString &currencyCode, const QString &currencySymbol)
{
    m_profile.name = name.trimmed().isEmpty() ? QStringLiteral("User") : name.trimmed();
    m_profile.country = country;
    m_profile.currencyCode = currencyCode;
    m_profile.currencySymbol = currencySymbol;
    m_hasProfile = true;

    if (m_db) {
        const QJsonObject obj{
            {QStringLiteral("name"), m_profile.name},
            {QStringLiteral("country"), m_profile.country},
            {QStringLiteral("currencyCode"), m_profile.currencyCode},
            {QStringLiteral("currencySymbol"), m_profile.currencySymbol},
        };
        m_db->setSetting(QStringLiteral("user_profile"), QString::fromUtf8(QJsonDocument(obj).toJson(QJsonDocument::Compact)));
    }
    Q_EMIT profileChanged();
}

void SettingsManager::saveAIConfig(const QVariantMap &configMap)
{
    m_aiConfig.enabled = configMap.value(QStringLiteral("enabled"), m_aiConfig.enabled).toBool();
    m_aiConfig.provider = configMap.value(QStringLiteral("provider"), m_aiConfig.provider).toString();
    m_aiConfig.ollamaEndpoint = configMap.value(QStringLiteral("ollamaEndpoint"), m_aiConfig.ollamaEndpoint).toString();
    m_aiConfig.ollamaModel = configMap.value(QStringLiteral("ollamaModel"), m_aiConfig.ollamaModel).toString();
    m_aiConfig.geminiApiKey = configMap.value(QStringLiteral("geminiApiKey"), m_aiConfig.geminiApiKey).toString();
    m_aiConfig.geminiModel = configMap.value(QStringLiteral("geminiModel"), m_aiConfig.geminiModel).toString();
    m_aiConfig.openaiApiKey = configMap.value(QStringLiteral("openaiApiKey"), m_aiConfig.openaiApiKey).toString();
    m_aiConfig.openaiModel = configMap.value(QStringLiteral("openaiModel"), m_aiConfig.openaiModel).toString();
    m_aiConfig.anthropicApiKey = configMap.value(QStringLiteral("anthropicApiKey"), m_aiConfig.anthropicApiKey).toString();
    m_aiConfig.anthropicModel = configMap.value(QStringLiteral("anthropicModel"), m_aiConfig.anthropicModel).toString();

    if (m_db) {
        const QJsonObject obj = QJsonObject::fromVariantMap(aiConfigMap());
        m_db->setSetting(QStringLiteral("ai_config"), QString::fromUtf8(QJsonDocument(obj).toJson(QJsonDocument::Compact)));
    }
    Q_EMIT aiConfigChanged();
}

QVariantMap SettingsManager::currencyForCountry(const QString &countryName) const
{
    for (const auto &c : allCountries()) {
        if (c.country.compare(countryName, Qt::CaseInsensitive) == 0) {
            return {
                {QStringLiteral("country"), c.country},
                {QStringLiteral("code"), c.code},
                {QStringLiteral("currencyCode"), c.currencyCode},
                {QStringLiteral("currencyName"), c.currencyName},
                {QStringLiteral("symbol"), c.symbol},
            };
        }
    }
    const auto &fallback = allCountries().first();
    return {
        {QStringLiteral("country"), fallback.country},
        {QStringLiteral("code"), fallback.code},
        {QStringLiteral("currencyCode"), fallback.currencyCode},
        {QStringLiteral("currencyName"), fallback.currencyName},
        {QStringLiteral("symbol"), fallback.symbol},
    };
}

} // namespace Finly
