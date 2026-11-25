#include <QtGlobal>
#ifdef Q_OS_ANDROID
#include <QGuiApplication>
#else
#include <QApplication>
#endif
#include <QDir>
#include <QIcon>
#include <QLibraryInfo>
#include <QQmlApplicationEngine>
#include <QQuickStyle>
#include <QUrl>
#include <QtQml>

#include <KAboutData>
#include <KLocalizedQmlContext>
#include <KLocalizedString>

#include "core/DatabaseManager.h"
#include "core/SettingsManager.h"
#include "models/AccountModel.h"
#include "models/BudgetModel.h"
#include "models/CategoryModel.h"
#include "models/LoanModel.h"
#include "models/TransactionModel.h"
#include "services/AiService.h"
#include "services/CsvService.h"
#include "services/NotificationService.h"
#include "services/ReminderService.h"
#include "services/TrayService.h"

int main(int argc, char *argv[])
{
#ifdef Q_OS_ANDROID
    QGuiApplication app(argc, argv);
#else
    QApplication app(argc, argv);
#endif

    KLocalizedString::setApplicationDomain("finly");

    KAboutData aboutData(
        QStringLiteral("finly"),
        i18n("Finly"),
        QStringLiteral("0.1.0"),
        i18n("Local-first personal finance manager"),
        KAboutLicense::MIT,
        i18n("© 2026 Finly Contributors")
    );
    aboutData.setOrganizationDomain("kumar.com");
    aboutData.setDesktopFileName(QStringLiteral("com.kumar.finly"));
    KAboutData::setApplicationData(aboutData);

    QIcon appIcon = QIcon::fromTheme(QStringLiteral("com.kumar.finly"));
    if (appIcon.isNull() || appIcon.pixmap(32, 32).isNull()) {
        appIcon = QIcon(QStringLiteral(":/icons/com.kumar.finly.svg"));
    }
#ifdef Q_OS_ANDROID
    QIcon::setThemeSearchPaths({QStringLiteral(":/icons")});
    QIcon::setThemeName(QStringLiteral("breeze"));
    QGuiApplication::setWindowIcon(appIcon);
    if (qEnvironmentVariableIsEmpty("QT_QUICK_CONTROLS_STYLE")) {
        QQuickStyle::setStyle(QStringLiteral("Material"));
    }
#else
    QApplication::setWindowIcon(appIcon);
    if (qEnvironmentVariableIsEmpty("QT_QUICK_CONTROLS_STYLE")) {
        const QString kdeDesktopStyle =
            QLibraryInfo::path(QLibraryInfo::QmlImportsPath) + QStringLiteral("/org/kde/desktop");
        if (QDir(kdeDesktopStyle).exists()) {
            QQuickStyle::setStyle(QStringLiteral("org.kde.desktop"));
        } else {
            QQuickStyle::setStyle(QStringLiteral("Fusion"));
        }
    }
#endif


    Finly::DatabaseManager db;
    if (!db.initialize()) {
        qFatal("Failed to initialize Finly SQLite database: %s", qPrintable(db.lastError()));
    }

    Finly::SettingsManager settingsMgr(&db);
    settingsMgr.load();

    Finly::AccountModel accountModel(&db);
    accountModel.refresh();

    Finly::TransactionModel transactionModel(&db, &accountModel);
    transactionModel.refresh();

    Finly::TransactionFilterProxyModel transactionFilter;
    transactionFilter.setSourceModel(&transactionModel);

    Finly::BudgetModel budgetModel(&db, &transactionModel);
    budgetModel.load();

    Finly::CategoryModel categoryModel(&db, &transactionModel);
    categoryModel.load();

    Finly::LoanModel loanModel(&db, &transactionModel);
    loanModel.load();

    Finly::CsvService csvService;
    Finly::NotificationService notificationService;
    Finly::ReminderService reminderService(&db, &notificationService);
    reminderService.load();
    Finly::TrayService trayService;
#ifndef Q_OS_ANDROID
    if (trayService.isAvailable()) {
        QApplication::setQuitOnLastWindowClosed(false);
    }
#endif
    Finly::AiService aiService(&settingsMgr, &accountModel, &transactionModel, &budgetModel, &categoryModel, &loanModel, &notificationService);

    QQmlApplicationEngine engine;
    KLocalization::setupLocalizedContext(&engine);
    engine.rootContext()->setContextProperty(QStringLiteral("SettingsMgr"), &settingsMgr);
    engine.rootContext()->setContextProperty(QStringLiteral("Accounts"), &accountModel);
    engine.rootContext()->setContextProperty(QStringLiteral("Transactions"), &transactionModel);
    engine.rootContext()->setContextProperty(QStringLiteral("TransactionFilter"), &transactionFilter);
    engine.rootContext()->setContextProperty(QStringLiteral("Budgets"), &budgetModel);
    engine.rootContext()->setContextProperty(QStringLiteral("Categories"), &categoryModel);
    engine.rootContext()->setContextProperty(QStringLiteral("Loans"), &loanModel);
    engine.rootContext()->setContextProperty(QStringLiteral("CsvSvc"), &csvService);
    engine.rootContext()->setContextProperty(QStringLiteral("NotifySvc"), &notificationService);
    engine.rootContext()->setContextProperty(QStringLiteral("ReminderSvc"), &reminderService);
    engine.rootContext()->setContextProperty(QStringLiteral("TraySvc"), &trayService);
    engine.rootContext()->setContextProperty(QStringLiteral("AiSvc"), &aiService);
    engine.loadFromModule("com.kumar.finly", "Main");

    if (engine.rootObjects().isEmpty()) {
        return -1;
    }

    return app.exec();
}
