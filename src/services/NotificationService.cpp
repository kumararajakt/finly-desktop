#include "NotificationService.h"

#ifdef Q_OS_ANDROID
#include <QCoreApplication>
#include <QJniEnvironment>
#include <QJniObject>
#else
#include <KNotification>
#endif

namespace Finly {

NotificationService::NotificationService(QObject *parent)
    : QObject(parent)
{
}

void NotificationService::notify(const QString &title, const QString &body)
{
#ifdef Q_OS_ANDROID
    const int sdkInt = QJniObject::getStaticField<jint>("android/os/Build$VERSION", "SDK_INT");

    QNativeInterface::QAndroidApplication::runOnAndroidMainThread([title, body, sdkInt]() {
        QJniObject context = QNativeInterface::QAndroidApplication::context();
        if (!context.isValid()) {
            return;
        }

        if (sdkInt >= 33) {
            const jint granted = context.callMethod<jint>(
                "checkSelfPermission",
                "(Ljava/lang/String;)I",
                QJniObject::fromString(QStringLiteral("android.permission.POST_NOTIFICATIONS")).object<jstring>());
            if (granted != 0) {
                QJniEnvironment env;
                jobjectArray perms = env->NewObjectArray(
                    1,
                    env->FindClass("java/lang/String"),
                    QJniObject::fromString(QStringLiteral("android.permission.POST_NOTIFICATIONS")).object<jstring>());
                context.callMethod<void>("requestPermissions", "([Ljava/lang/String;I)V", perms, 1001);
                env->DeleteLocalRef(perms);
                return;
            }
        }

        QJniObject serviceName = QJniObject::getStaticObjectField(
            "android/content/Context", "NOTIFICATION_SERVICE", "Ljava/lang/String;");
        QJniObject nm = context.callObjectMethod(
            "getSystemService", "(Ljava/lang/String;)Ljava/lang/Object;", serviceName.object<jstring>());
        if (!nm.isValid()) {
            return;
        }

        const QString channelId = QStringLiteral("finly_reminders");
        if (sdkInt >= 26) {
            QJniObject jChannelId = QJniObject::fromString(channelId);
            QJniObject jChannelName = QJniObject::fromString(QStringLiteral("Finly Reminders"));
            // IMPORTANCE_HIGH = 4
            QJniObject channel(
                "android/app/NotificationChannel",
                "(Ljava/lang/String;Ljava/lang/CharSequence;I)V",
                jChannelId.object<jstring>(),
                jChannelName.object<jstring>(),
                4);
            nm.callMethod<void>(
                "createNotificationChannel",
                "(Landroid/app/NotificationChannel;)V",
                channel.object());
        }

        QJniObject builder = (sdkInt >= 26)
            ? QJniObject(
                  "android/app/Notification$Builder",
                  "(Landroid/content/Context;Ljava/lang/String;)V",
                  context.object(),
                  QJniObject::fromString(channelId).object<jstring>())
            : QJniObject(
                  "android/app/Notification$Builder",
                  "(Landroid/content/Context;)V",
                  context.object());

        QJniObject res = context.callObjectMethod("getResources", "()Landroid/content/res/Resources;");
        QJniObject pkg = context.callObjectMethod("getPackageName", "()Ljava/lang/String;");
        jint iconId = res.callMethod<jint>(
            "getIdentifier",
            "(Ljava/lang/String;Ljava/lang/String;Ljava/lang/String;)I",
            QJniObject::fromString(QStringLiteral("ic_launcher")).object<jstring>(),
            QJniObject::fromString(QStringLiteral("drawable")).object<jstring>(),
            pkg.object<jstring>());
        if (iconId == 0) {
            iconId = 17301659; // android.R.drawable.ic_dialog_info
        }

        builder.callObjectMethod("setSmallIcon", "(I)Landroid/app/Notification$Builder;", iconId);
        builder.callObjectMethod(
            "setContentTitle",
            "(Ljava/lang/CharSequence;)Landroid/app/Notification$Builder;",
            QJniObject::fromString(title).object<jstring>());
        builder.callObjectMethod(
            "setContentText",
            "(Ljava/lang/CharSequence;)Landroid/app/Notification$Builder;",
            QJniObject::fromString(body).object<jstring>());
        builder.callObjectMethod("setAutoCancel", "(Z)Landroid/app/Notification$Builder;", true);

        QJniObject notification = builder.callObjectMethod("build", "()Landroid/app/Notification;");
        static jint s_notifId = 1001;
        nm.callMethod<void>("notify", "(ILandroid/app/Notification;)V", s_notifId++, notification.object());
    });
#else
    KNotification::event(
        KNotification::Notification,
        title,
        body,
        QStringLiteral("com.kumar.finly"),
        KNotification::CloseOnTimeout
    );
#endif
}

} // namespace Finly
