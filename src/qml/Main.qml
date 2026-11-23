import QtQuick
import QtQuick.Controls as Controls
import QtQuick.Layouts
import org.kde.kirigami as Kirigami

Kirigami.ApplicationWindow {
    id: root

    title: i18n("Finly")
    width: 1440
    height: 900
    minimumWidth: 960
    minimumHeight: 640

    globalDrawer: Kirigami.GlobalDrawer {
        id: sidebar
        title: i18n("Finly")
        titleIcon: "com.kumar.finly"
        isMenu: false
        modal: false
        collapsible: false
        width: 256

        actions: [
            Kirigami.Action {
                text: i18n("Dashboard")
                icon.name: "view-dashboard"
                checked: true
            },
            Kirigami.Action {
                text: i18n("Transactions")
                icon.name: "view-list-details"
            },
            Kirigami.Action {
                text: i18n("Budgets")
                icon.name: "office-chart-pie"
            },
            Kirigami.Action {
                text: i18n("Categories")
                icon.name: "tag"
            },
            Kirigami.Action {
                text: i18n("Loans & Debts")
                icon.name: "wallet-open"
            }
        ]
    }

    pageStack.initialPage: Kirigami.ScrollablePage {
        title: i18n("Dashboard")

        Kirigami.PlaceholderMessage {
            anchors.centerIn: parent
            width: parent.width - (Kirigami.Units.largeSpacing * 4)
            icon.name: "com.kumar.finly"
            text: i18n("Welcome to Finly")
            explanation: i18n("Kirigami shell initialized. Next: SQLite backend, data models, and views.")
        }
    }
}
