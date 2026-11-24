#include "NotificationService.h"

#include <KNotification>

namespace Finly {

NotificationService::NotificationService(QObject *parent)
    : QObject(parent)
{
}

void NotificationService::notify(const QString &title, const QString &body)
{
    KNotification::event(
        KNotification::Notification,
        title,
        body,
        QStringLiteral("com.kumar.finly"),
        KNotification::CloseOnTimeout
    );
}

} // namespace Finly
