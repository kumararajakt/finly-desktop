#include "TrayService.h"

#include <QAction>
#include <QCoreApplication>
#include <QIcon>

namespace Finly {

TrayService::TrayService(QObject *parent)
    : QObject(parent)
{
    if (!QSystemTrayIcon::isSystemTrayAvailable()) {
        return;
    }

    const QIcon icon = QIcon::fromTheme(
        QStringLiteral("com.kumar.finly"),
        QIcon::fromTheme(QStringLiteral("wallet-open"))
    );

    m_trayIcon = new QSystemTrayIcon(icon, this);
    m_trayIcon->setToolTip(QStringLiteral("Finly — Personal Finance"));

    m_menu = new QMenu();
    auto *showAction = m_menu->addAction(QIcon::fromTheme(QStringLiteral("window-restore")), tr("Show Finly"));
    connect(showAction, &QAction::triggered, this, &TrayService::showWindowRequested);

    m_menu->addSeparator();

    auto *quitAction = m_menu->addAction(QIcon::fromTheme(QStringLiteral("application-exit")), tr("Quit"));
    connect(quitAction, &QAction::triggered, this, [this]() {
        Q_EMIT quitRequested();
        QCoreApplication::quit();
    });

    m_trayIcon->setContextMenu(m_menu);

    connect(m_trayIcon, &QSystemTrayIcon::activated, this, [this](QSystemTrayIcon::ActivationReason reason) {
        if (reason == QSystemTrayIcon::Trigger || reason == QSystemTrayIcon::DoubleClick) {
            Q_EMIT toggleWindowRequested();
        }
    });

    m_trayIcon->show();
}

bool TrayService::isAvailable() const
{
    return m_trayIcon != nullptr;
}

} // namespace Finly
