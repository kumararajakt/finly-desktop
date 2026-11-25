#pragma once

#include <QObject>
#ifndef Q_OS_ANDROID
#include <QMenu>
#include <QSystemTrayIcon>
#endif

namespace Finly {

class TrayService : public QObject
{
    Q_OBJECT

    Q_PROPERTY(bool available READ isAvailable CONSTANT)

public:
    explicit TrayService(QObject *parent = nullptr);

    bool isAvailable() const;

Q_SIGNALS:
    void toggleWindowRequested();
    void showWindowRequested();
    void quitRequested();

private:
#ifndef Q_OS_ANDROID
    QSystemTrayIcon *m_trayIcon = nullptr;
    QMenu *m_menu = nullptr;
#endif
};

} // namespace Finly
