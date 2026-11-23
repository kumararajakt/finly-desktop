#include "NotificationService.h"

#include <KNotification>

namespace Finly {

NotificationService::NotificationService(QObject *parent)
    : QObject(parent)
{
}

void NotificationService::notify(const QString &title, const QString &body)
{
    auto *notification = new KNotification(QStringLiteral("notification"), KNotification::CloseOnTimeout, this);
    notification->setTitle(title);
    notification->setText(body);
    notification->sendEvent();
}

} // namespace Finly
