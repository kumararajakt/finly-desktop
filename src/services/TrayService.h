#pragma once

#include <QMenu>
#include <QObject>
#include <QSystemTrayIcon>

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
    QSystemTrayIcon *m_trayIcon = nullptr;
    QMenu *m_menu = nullptr;
};

} // namespace Finly
