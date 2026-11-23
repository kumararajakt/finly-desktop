#pragma once

#include <QObject>
#include <QString>

namespace Finly {

class NotificationService : public QObject
{
    Q_OBJECT

public:
    explicit NotificationService(QObject *parent = nullptr);

    Q_INVOKABLE void notify(const QString &title, const QString &body);
};

} // namespace Finly
