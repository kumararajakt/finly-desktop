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


    QQmlApplicationEngine engine;
    KLocalization::setupLocalizedContext(&engine);
    engine.loadFromModule("com.kumar.finly", "Main");

    if (engine.rootObjects().isEmpty()) {
        return -1;
    }

    return app.exec();
}
