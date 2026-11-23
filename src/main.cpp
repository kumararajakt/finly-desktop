#include <QApplication>
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

int main(int argc, char *argv[])
{
    QApplication app(argc, argv);

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

    QApplication::setWindowIcon(QIcon::fromTheme(QStringLiteral("com.kumar.finly")));

    if (qEnvironmentVariableIsEmpty("QT_QUICK_CONTROLS_STYLE")) {
        QQuickStyle::setStyle(QStringLiteral("org.kde.desktop"));
    }


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

    QQmlApplicationEngine engine;
    KLocalization::setupLocalizedContext(&engine);
    engine.rootContext()->setContextProperty(QStringLiteral("SettingsMgr"), &settingsMgr);
    engine.rootContext()->setContextProperty(QStringLiteral("Accounts"), &accountModel);
    engine.rootContext()->setContextProperty(QStringLiteral("Transactions"), &transactionModel);
    engine.rootContext()->setContextProperty(QStringLiteral("TransactionFilter"), &transactionFilter);
    engine.rootContext()->setContextProperty(QStringLiteral("Budgets"), &budgetModel);
    engine.rootContext()->setContextProperty(QStringLiteral("Categories"), &categoryModel);
    engine.rootContext()->setContextProperty(QStringLiteral("Loans"), &loanModel);
    engine.loadFromModule("com.kumar.finly", "Main");

    if (engine.rootObjects().isEmpty()) {
        return -1;
    }

    return app.exec();
}
