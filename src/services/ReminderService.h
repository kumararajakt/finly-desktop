#pragma once

#include "../core/DatabaseManager.h"
#include "NotificationService.h"

#include <QDate>
#include <QObject>
#include <QTimer>
#include <QVariantList>
#include <QVariantMap>

namespace Finly {

class ReminderService : public QObject
{
    Q_OBJECT

    Q_PROPERTY(QVariantMap config READ configMap NOTIFY configChanged)
    Q_PROPERTY(QString scheduleSummary READ scheduleSummary NOTIFY configChanged)

public:
    explicit ReminderService(DatabaseManager *db, NotificationService *notifications, QObject *parent = nullptr);

    void load();

    QVariantMap configMap() const;
    QString scheduleSummary() const;

    Q_INVOKABLE void saveConfig(const QVariantMap &map);
    Q_INVOKABLE void sendTestNotification();

Q_SIGNALS:
    void configChanged();

private Q_SLOTS:
    void checkAndTrigger();

private:
    void save();
    bool matchesSchedule(const QDate &today) const;
    static int sun0DayOfWeek(const QDate &d);
    static bool matchesOrdinalWeekday(const QDate &d, const QString &ordinal, int sun0Day);

    DatabaseManager *m_db = nullptr;
    NotificationService *m_notifications = nullptr;
    QTimer *m_timer = nullptr;

    bool m_enabled = false;
    QString m_title = QStringLiteral("Finly Reminder");
    QString m_message = QStringLiteral("Time to log today's expenses and review your budgets!");
    QString m_frequency = QStringLiteral("day"); // "day" | "week" | "month" | "year"
    int m_interval = 1;
    QVariantList m_weekDays = {1}; // 0=Sun..6=Sat
    QString m_monthMode = QStringLiteral("day"); // "day" | "weekday"
    int m_monthDay = 1;
    QString m_monthWeekOrdinal = QStringLiteral("first");
    int m_monthWeekDay = 1; // 0=Sun..6=Sat
    QString m_time = QStringLiteral("12:00");
    QString m_starts;
    QString m_endsMode = QStringLiteral("never"); // "never" | "on" | "after"
    QString m_endsDate;
    int m_endsCount = 1;
    int m_occurrencesTriggered = 0;
    QString m_lastTriggeredKey;
};

} // namespace Finly
