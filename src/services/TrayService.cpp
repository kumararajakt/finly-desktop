#include "TrayService.h"

#ifndef Q_OS_ANDROID
#include <QAction>
#include <QCoreApplication>
#include <QIcon>
#include <QTimer>
#endif

namespace Finly {

TrayService::TrayService(QObject *parent)
    : QObject(parent)
{
#ifndef Q_OS_ANDROID
    QIcon icon(QStringLiteral(":/icons/com.kumar.finly.svg"));
    if (icon.isNull() || icon.pixmap(32, 32).isNull()) {
        icon = QIcon::fromTheme(QStringLiteral("com.kumar.finly"));
    }
    if (icon.isNull() || icon.pixmap(32, 32).isNull()) {
        icon = QIcon::fromTheme(QStringLiteral("wallet-open"));
    }

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

    if (QSystemTrayIcon::isSystemTrayAvailable()) {
        m_trayIcon->show();
    } else {
        QTimer::singleShot(1500, this, [this]() {
            if (m_trayIcon && QSystemTrayIcon::isSystemTrayAvailable()) {
                m_trayIcon->show();
            }
        });
    }
#endif
}

bool TrayService::isAvailable() const
{
#ifdef Q_OS_ANDROID
    return false;
#else
    return m_trayIcon != nullptr && QSystemTrayIcon::isSystemTrayAvailable();
#endif
}

} // namespace Finly
