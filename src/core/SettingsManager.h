#pragma once

#include "DatabaseManager.h"
#include "Types.h"

#include <QObject>
#include <QVariantList>
#include <QVariantMap>

namespace Finly {

class SettingsManager : public QObject
{
    Q_OBJECT

    Q_PROPERTY(bool hasProfile READ hasProfile NOTIFY profileChanged)
    Q_PROPERTY(QString userName READ userName NOTIFY profileChanged)
    Q_PROPERTY(QString country READ country NOTIFY profileChanged)
    Q_PROPERTY(QString currencyCode READ currencyCode NOTIFY profileChanged)
    Q_PROPERTY(QString currencySymbol READ currencySymbol NOTIFY profileChanged)
    Q_PROPERTY(QString theme READ theme WRITE setTheme NOTIFY themeChanged)
    Q_PROPERTY(bool minimizeToTray READ minimizeToTray WRITE setMinimizeToTray NOTIFY minimizeToTrayChanged)
    Q_PROPERTY(int windowWidth READ windowWidth NOTIFY windowGeometryChanged)
    Q_PROPERTY(int windowHeight READ windowHeight NOTIFY windowGeometryChanged)

    Q_PROPERTY(bool aiEnabled READ aiEnabled NOTIFY aiConfigChanged)
    Q_PROPERTY(QString aiProvider READ aiProvider NOTIFY aiConfigChanged)
    Q_PROPERTY(QVariantMap aiConfig READ aiConfigMap NOTIFY aiConfigChanged)
    Q_PROPERTY(QVariantList countries READ countriesList CONSTANT)

public:
    explicit SettingsManager(DatabaseManager *db, QObject *parent = nullptr);

    void load();

    bool hasProfile() const;
    QString userName() const;
    QString country() const;
    QString currencyCode() const;
    QString currencySymbol() const;

    QString theme() const;
    void setTheme(const QString &mode);

    bool minimizeToTray() const;
    void setMinimizeToTray(bool enabled);

    int windowWidth() const;
    int windowHeight() const;

    bool aiEnabled() const;
    QString aiProvider() const;
    QVariantMap aiConfigMap() const;
    AIConfig aiConfig() const;

    QVariantList countriesList() const;

    Q_INVOKABLE void saveProfile(const QString &name, const QString &country, const QString &currencyCode, const QString &currencySymbol);
    Q_INVOKABLE void saveAIConfig(const QVariantMap &configMap);
    Q_INVOKABLE void saveWindowGeometry(int width, int height);
    Q_INVOKABLE QVariantMap currencyForCountry(const QString &countryName) const;

Q_SIGNALS:
    void profileChanged();
    void themeChanged();
    void minimizeToTrayChanged();
    void windowGeometryChanged();
    void aiConfigChanged();

private:
    static const QVector<CountryCurrency> &allCountries();

    DatabaseManager *m_db = nullptr;
    bool m_hasProfile = false;
    UserProfile m_profile;
    QString m_theme = QStringLiteral("auto");
    bool m_minimizeToTray = true;
    int m_windowWidth = 1440;
    int m_windowHeight = 900;
    AIConfig m_aiConfig;
};

} // namespace Finly
