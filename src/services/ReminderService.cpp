#include "ReminderService.h"

#include <QDateTime>
#include <QJsonDocument>
#include <QJsonObject>

namespace Finly {

ReminderService::ReminderService(DatabaseManager *db, NotificationService *notifications, QObject *parent)
    : QObject(parent)
    , m_db(db)
    , m_notifications(notifications)
    , m_timer(new QTimer(this))
{
    const QDate today = QDate::currentDate();
    m_starts = today.toString(Qt::ISODate);
    m_endsDate = today.toString(Qt::ISODate);
    m_monthDay = today.day();

    connect(m_timer, &QTimer::timeout, this, &ReminderService::checkAndTrigger);
    m_timer->start(20000);
}

void ReminderService::load()
{
    if (!m_db) {
        return;
    }
    if (const auto json = m_db->getSetting(QStringLiteral("user_reminder"))) {
        const QVariantMap m = QJsonDocument::fromJson(json->toUtf8()).object().toVariantMap();
        if (!m.isEmpty()) {
            m_enabled = m.value(QStringLiteral("enabled"), false).toBool();
            m_title = m.value(QStringLiteral("title"), m_title).toString();
            m_message = m.value(QStringLiteral("message"), m_message).toString();
            m_frequency = m.value(QStringLiteral("frequency"), QStringLiteral("day")).toString();
            m_interval = qMax(1, m.value(QStringLiteral("interval"), 1).toInt());
            if (m.contains(QStringLiteral("weekDays"))) {
                m_weekDays = m.value(QStringLiteral("weekDays")).toList();
            }
            m_monthMode = m.value(QStringLiteral("monthMode"), QStringLiteral("day")).toString();
            m_monthDay = qBound(1, m.value(QStringLiteral("monthDay"), QDate::currentDate().day()).toInt(), 31);
            m_monthWeekOrdinal = m.value(QStringLiteral("monthWeekOrdinal"), QStringLiteral("first")).toString();
            m_monthWeekDay = qBound(0, m.value(QStringLiteral("monthWeekDay"), 1).toInt(), 6);
            m_time = m.value(QStringLiteral("time"), QStringLiteral("12:00")).toString();
            m_starts = m.value(QStringLiteral("starts"), m_starts).toString();
            m_endsMode = m.value(QStringLiteral("endsMode"), QStringLiteral("never")).toString();
            m_endsDate = m.value(QStringLiteral("endsDate"), m_endsDate).toString();
            m_endsCount = qMax(1, m.value(QStringLiteral("endsCount"), 1).toInt());
            m_occurrencesTriggered = m.value(QStringLiteral("occurrencesTriggered"), 0).toInt();
            m_lastTriggeredKey = m.value(QStringLiteral("lastTriggeredKey")).toString();
            Q_EMIT configChanged();
        }
    }
}

void ReminderService::save()
{
    if (!m_db) {
        return;
    }
    const QJsonObject obj = QJsonObject::fromVariantMap(configMap());
    m_db->setSetting(QStringLiteral("user_reminder"), QString::fromUtf8(QJsonDocument(obj).toJson(QJsonDocument::Compact)));
}

QVariantMap ReminderService::configMap() const
{
    return {
        {QStringLiteral("enabled"), m_enabled},
        {QStringLiteral("title"), m_title},
        {QStringLiteral("message"), m_message},
        {QStringLiteral("frequency"), m_frequency},
        {QStringLiteral("interval"), m_interval},
        {QStringLiteral("weekDays"), m_weekDays},
        {QStringLiteral("monthMode"), m_monthMode},
        {QStringLiteral("monthDay"), m_monthDay},
        {QStringLiteral("monthWeekOrdinal"), m_monthWeekOrdinal},
        {QStringLiteral("monthWeekDay"), m_monthWeekDay},
        {QStringLiteral("time"), m_time},
        {QStringLiteral("starts"), m_starts},
        {QStringLiteral("endsMode"), m_endsMode},
        {QStringLiteral("endsDate"), m_endsDate},
        {QStringLiteral("endsCount"), m_endsCount},
        {QStringLiteral("occurrencesTriggered"), m_occurrencesTriggered},
        {QStringLiteral("lastTriggeredKey"), m_lastTriggeredKey},
    };
}

QString ReminderService::scheduleSummary() const
{
    static const QStringList dayNames = {
        QStringLiteral("Sun"), QStringLiteral("Mon"), QStringLiteral("Tue"),
        QStringLiteral("Wed"), QStringLiteral("Thu"), QStringLiteral("Fri"), QStringLiteral("Sat")
    };

    QString freqText;
    if (m_frequency == QStringLiteral("day")) {
        freqText = m_interval == 1 ? tr("Every day") : tr("Every %1 days").arg(m_interval);
    } else if (m_frequency == QStringLiteral("week")) {
        QStringList days;
        for (const QVariant &v : m_weekDays) {
            const int d = v.toInt();
            if (d >= 0 && d < 7) days.append(dayNames.at(d));
        }
        freqText = (m_interval == 1 ? tr("Every week") : tr("Every %1 weeks").arg(m_interval))
            + (days.isEmpty() ? QString() : tr(" on %1").arg(days.join(QStringLiteral(", "))));
    } else if (m_frequency == QStringLiteral("month")) {
        const QString base = m_interval == 1 ? tr("Every month") : tr("Every %1 months").arg(m_interval);
        if (m_monthMode == QStringLiteral("day")) {
            freqText = tr("%1 on day %2").arg(base).arg(m_monthDay);
        } else {
            freqText = tr("%1 on the %2 %3").arg(base, m_monthWeekOrdinal, dayNames.value(m_monthWeekDay));
        }
    } else {
        freqText = m_interval == 1 ? tr("Every year") : tr("Every %1 years").arg(m_interval);
    }

    QString endText = tr("Never ends");
    if (m_endsMode == QStringLiteral("on")) {
        endText = tr("Ends on %1").arg(m_endsDate);
    } else if (m_endsMode == QStringLiteral("after")) {
        endText = tr("Ends after %1 occurrence(s)").arg(m_endsCount);
    }

    return tr("%1 at %2 · Starts %3 · %4").arg(freqText, m_time, m_starts, endText);
}

void ReminderService::saveConfig(const QVariantMap &map)
{
    m_enabled = map.value(QStringLiteral("enabled"), m_enabled).toBool();
    m_title = map.value(QStringLiteral("title"), m_title).toString().trimmed();
    if (m_title.isEmpty()) m_title = QStringLiteral("Finly Reminder");
    m_message = map.value(QStringLiteral("message"), m_message).toString().trimmed();
    if (m_message.isEmpty()) m_message = QStringLiteral("Time to log today's expenses and review your budgets!");
    m_frequency = map.value(QStringLiteral("frequency"), m_frequency).toString();
    m_interval = qMax(1, map.value(QStringLiteral("interval"), m_interval).toInt());
    if (map.contains(QStringLiteral("weekDays"))) {
        m_weekDays = map.value(QStringLiteral("weekDays")).toList();
    }
    m_monthMode = map.value(QStringLiteral("monthMode"), m_monthMode).toString();
    m_monthDay = qBound(1, map.value(QStringLiteral("monthDay"), m_monthDay).toInt(), 31);
    m_monthWeekOrdinal = map.value(QStringLiteral("monthWeekOrdinal"), m_monthWeekOrdinal).toString();
    m_monthWeekDay = qBound(0, map.value(QStringLiteral("monthWeekDay"), m_monthWeekDay).toInt(), 6);
    m_time = map.value(QStringLiteral("time"), m_time).toString();
    m_starts = map.value(QStringLiteral("starts"), m_starts).toString();
    m_endsMode = map.value(QStringLiteral("endsMode"), m_endsMode).toString();
    m_endsDate = map.value(QStringLiteral("endsDate"), m_endsDate).toString();
    m_endsCount = qMax(1, map.value(QStringLiteral("endsCount"), m_endsCount).toInt());
    if (map.value(QStringLiteral("resetOccurrences"), false).toBool()) {
        m_occurrencesTriggered = 0;
        m_lastTriggeredKey.clear();
    }

    save();
    Q_EMIT configChanged();
}

void ReminderService::sendTestNotification()
{
    if (m_notifications) {
        m_notifications->notify(m_title, m_message);
    }
}

int ReminderService::sun0DayOfWeek(const QDate &d)
{
    // Qt: Mon=1..Sun=7 -> Sun=0..Sat=6
    return d.dayOfWeek() % 7;
}

bool ReminderService::matchesOrdinalWeekday(const QDate &d, const QString &ordinal, int sun0Day)
{
    if (sun0DayOfWeek(d) != sun0Day) {
        return false;
    }
    if (ordinal == QStringLiteral("last")) {
        return d.addDays(7).month() != d.month();
    }
    const int nth = (d.day() - 1) / 7 + 1;
    if (ordinal == QStringLiteral("first")) return nth == 1;
    if (ordinal == QStringLiteral("second")) return nth == 2;
    if (ordinal == QStringLiteral("third")) return nth == 3;
    if (ordinal == QStringLiteral("fourth")) return nth == 4;
    return false;
}

bool ReminderService::matchesSchedule(const QDate &today) const
{
    const QDate startDate = QDate::fromString(m_starts, Qt::ISODate);
    if (!startDate.isValid() || today < startDate) {
        return false;
    }
    if (m_endsMode == QStringLiteral("on")) {
        const QDate endDate = QDate::fromString(m_endsDate, Qt::ISODate);
        if (endDate.isValid() && today > endDate) {
            return false;
        }
    } else if (m_endsMode == QStringLiteral("after")) {
        if (m_occurrencesTriggered >= m_endsCount) {
            return false;
        }
    }

    if (m_frequency == QStringLiteral("day")) {
        return (startDate.daysTo(today) % m_interval) == 0;
    }
    if (m_frequency == QStringLiteral("week")) {
        const int todayDow = sun0DayOfWeek(today);
        bool dayMatch = false;
        for (const QVariant &v : m_weekDays) {
            if (v.toInt() == todayDow) {
                dayMatch = true;
                break;
            }
        }
        if (!dayMatch) return false;
        const QDate startWeekSun = startDate.addDays(-sun0DayOfWeek(startDate));
        const QDate todayWeekSun = today.addDays(-todayDow);
        const qint64 weeks = startWeekSun.daysTo(todayWeekSun) / 7;
        return (weeks % m_interval) == 0;
    }
    if (m_frequency == QStringLiteral("month")) {
        const int months = (today.year() - startDate.year()) * 12 + (today.month() - startDate.month());
        if (months < 0 || (months % m_interval) != 0) {
            return false;
        }
        if (m_monthMode == QStringLiteral("day")) {
            return today.day() == m_monthDay;
        }
        return matchesOrdinalWeekday(today, m_monthWeekOrdinal, m_monthWeekDay);
    }
    if (m_frequency == QStringLiteral("year")) {
        const int years = today.year() - startDate.year();
        return years >= 0 && (years % m_interval) == 0
            && today.month() == startDate.month()
            && today.day() == startDate.day();
    }
    return false;
}

void ReminderService::checkAndTrigger()
{
    if (!m_enabled) {
        return;
    }
    const QDateTime now = QDateTime::currentDateTime();
    const QString minuteKey = now.toString(QStringLiteral("yyyy-MM-dd HH:mm"));
    if (minuteKey == m_lastTriggeredKey) {
        return;
    }
    if (now.toString(QStringLiteral("HH:mm")) != m_time) {
        return;
    }
    if (!matchesSchedule(now.date())) {
        return;
    }

    m_lastTriggeredKey = minuteKey;
    ++m_occurrencesTriggered;
    save();
    Q_EMIT configChanged();

    if (m_notifications) {
        m_notifications->notify(m_title, m_message);
    }
}

} // namespace Finly
