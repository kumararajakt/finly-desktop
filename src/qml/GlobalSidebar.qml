import QtQuick
import QtQuick.Controls as Controls
import QtQuick.Layouts
import org.kde.kirigami as Kirigami

Kirigami.GlobalDrawer {
    id: drawer

    property string activeView: "dashboard"
    property string activeFilter: "all"

    signal selectView(string view)
    signal selectFilter(string filterId)
    signal openAddTransaction()
    signal openAddAccount()
    signal openSettings()
    signal openAskFinly()
    signal requestEditAccount(var accountData)
    signal requestDeleteAccount(string accountId, string accountName)

    isMenu: false
    modal: false
    collapsible: false
    width: 264
    padding: 0
    topPadding: 0
    bottomPadding: 0
    leftPadding: 0
    rightPadding: 0

    header: ColumnLayout {
        spacing: Kirigami.Units.smallSpacing
        Layout.fillWidth: true

        // Brand Header
        RowLayout {
            Layout.fillWidth: true
            Layout.margins: Kirigami.Units.largeSpacing
            Layout.bottomMargin: Kirigami.Units.smallSpacing
            spacing: Kirigami.Units.smallSpacing

            Rectangle {
                Layout.preferredWidth: 34
                Layout.preferredHeight: 34
                radius: 10
                color: Kirigami.Theme.highlightColor

                Controls.Label {
                    anchors.centerIn: parent
                    text: SettingsMgr.userName.length > 0 ? SettingsMgr.userName.charAt(0).toUpperCase() : "F"
                    color: Kirigami.Theme.highlightedTextColor
                    font.bold: true
                    font.pixelSize: 14
                }
            }

            ColumnLayout {
                Layout.fillWidth: true
                spacing: 0

                Controls.Label {
                    Layout.fillWidth: true
                    text: SettingsMgr.userName.length > 0 ? i18n("%1's Finly", SettingsMgr.userName) : i18n("Finly")
                    font.bold: true
                    font.pixelSize: 13
                    elide: Text.ElideRight
                }

                Controls.Label {
                    text: i18n("Personal Finance")
                    font.pixelSize: 11
                    opacity: 0.65
                }
            }

            Rectangle {
                implicitWidth: syncRow.implicitWidth + 12
                implicitHeight: 20
                radius: 10
                color: Qt.rgba(Kirigami.Theme.positiveTextColor.r, Kirigami.Theme.positiveTextColor.g, Kirigami.Theme.positiveTextColor.b, 0.14)

                RowLayout {
                    id: syncRow
                    anchors.centerIn: parent
                    spacing: 4

                    Rectangle {
                        width: 6
                        height: 6
                        radius: 3
                        color: Kirigami.Theme.positiveTextColor
                    }

                    Controls.Label {
                        text: i18n("Sync")
                        font.pixelSize: 10
                        font.bold: true
                        color: Kirigami.Theme.positiveTextColor
                    }
                }
            }
        }

        // Primary CTA: New Transaction
        Controls.Button {
            Layout.fillWidth: true
            Layout.leftMargin: Kirigami.Units.largeSpacing
            Layout.rightMargin: Kirigami.Units.largeSpacing
            text: i18n("New Transaction")
            icon.name: "list-add"
            highlighted: true
            onClicked: drawer.openAddTransaction()
        }

        // Conditional Ask Finly AI CTA
        Controls.Button {
            visible: SettingsMgr.aiEnabled
            Layout.fillWidth: true
            Layout.leftMargin: Kirigami.Units.largeSpacing
            Layout.rightMargin: Kirigami.Units.largeSpacing
            text: i18n("Ask Finly AI")
            icon.name: "quickopen"
            onClicked: drawer.openAskFinly()
        }

        Kirigami.Separator {
            Layout.fillWidth: true
            Layout.topMargin: Kirigami.Units.smallSpacing
        }
    }

    // Scrollable Navigation Body
    Controls.ScrollView {
        Layout.fillWidth: true
        Layout.fillHeight: true
        contentWidth: availableWidth
        clip: true

        ColumnLayout {
            width: parent.width
            spacing: 2

            // Overview Section
            Controls.Label {
                text: i18n("OVERVIEW")
                font.pixelSize: 10
                font.bold: true
                opacity: 0.55
                Layout.leftMargin: Kirigami.Units.largeSpacing
                Layout.topMargin: Kirigami.Units.smallSpacing
                Layout.bottomMargin: 2
            }

            Repeater {
                model: [
                    { id: "dashboard", label: i18n("Dashboard"), icon: "dashboard-show" },
                    { id: "budgets", label: i18n("Budgets"), icon: "office-chart-pie" },
                    { id: "categories", label: i18n("Categories"), icon: "tag" },
                    { id: "loans", label: i18n("Loans & Debts"), icon: "wallet-open" }
                ]

                delegate: Controls.ItemDelegate {
                    required property var modelData
                    Layout.fillWidth: true
                    Layout.leftMargin: Kirigami.Units.smallSpacing
                    Layout.rightMargin: Kirigami.Units.smallSpacing
                    text: modelData.label
                    icon.name: modelData.icon
                    highlighted: drawer.activeView === modelData.id
                    onClicked: drawer.selectView(modelData.id)
                }
            }

            // Transactions / Smart Filters Section
            Controls.Label {
                text: i18n("TRANSACTIONS")
                font.pixelSize: 10
                font.bold: true
                opacity: 0.55
                Layout.leftMargin: Kirigami.Units.largeSpacing
                Layout.topMargin: Kirigami.Units.largeSpacing
                Layout.bottomMargin: 2
            }

            Repeater {
                model: [
                    { id: "all", label: i18n("All Transactions"), icon: "view-list-details", badge: 0 },
                    { id: "pending", label: i18n("Pending"), icon: "chronometer", badge: Transactions.pendingCount },
                    { id: "cleared", label: i18n("Cleared"), icon: "checkmark", badge: 0 },
                    { id: "flagged", label: i18n("Flagged"), icon: "flag", badge: Transactions.flaggedCount }
                ]

                delegate: Controls.ItemDelegate {
                    required property var modelData
                    Layout.fillWidth: true
                    Layout.leftMargin: Kirigami.Units.smallSpacing
                    Layout.rightMargin: Kirigami.Units.smallSpacing
                    highlighted: drawer.activeView === "transactions" && drawer.activeFilter === modelData.id
                    onClicked: drawer.selectFilter(modelData.id)

                    contentItem: RowLayout {
                        spacing: Kirigami.Units.smallSpacing

                        Kirigami.Icon {
                            source: modelData.icon
                            Layout.preferredWidth: Kirigami.Units.iconSizes.small
                            Layout.preferredHeight: Kirigami.Units.iconSizes.small
                        }

                        Controls.Label {
                            Layout.fillWidth: true
                            text: modelData.label
                            elide: Text.ElideRight
                        }

                        Rectangle {
                            visible: modelData.badge > 0
                            implicitWidth: badgeLbl.implicitWidth + 10
                            implicitHeight: 18
                            radius: 9
                            color: modelData.id === "flagged"
                                ? Qt.rgba(Kirigami.Theme.neutralTextColor.r, Kirigami.Theme.neutralTextColor.g, Kirigami.Theme.neutralTextColor.b, 0.2)
                                : Qt.rgba(Kirigami.Theme.highlightColor.r, Kirigami.Theme.highlightColor.g, Kirigami.Theme.highlightColor.b, 0.2)

                            Controls.Label {
                                id: badgeLbl
                                anchors.centerIn: parent
                                text: modelData.badge
                                font.pixelSize: 10
                                font.bold: true
                            }
                        }
                    }
                }
            }

            // Accounts Section
            RowLayout {
                Layout.fillWidth: true
                Layout.leftMargin: Kirigami.Units.largeSpacing
                Layout.rightMargin: Kirigami.Units.largeSpacing
                Layout.topMargin: Kirigami.Units.largeSpacing
                Layout.bottomMargin: 2

                Controls.Label {
                    Layout.fillWidth: true
                    text: i18n("ACCOUNTS")
                    font.pixelSize: 10
                    font.bold: true
                    opacity: 0.55
                }

                Controls.ToolButton {
                    text: i18n("+ Add")
                    font.pixelSize: 11
                    onClicked: drawer.openAddAccount()
                }
            }

            Controls.Label {
                visible: Accounts.count === 0
                Layout.fillWidth: true
                Layout.leftMargin: Kirigami.Units.largeSpacing
                Layout.rightMargin: Kirigami.Units.largeSpacing
                Layout.topMargin: Kirigami.Units.smallSpacing
                text: i18n("No accounts yet. Click + Add to create one.")
                font.pixelSize: 11
                opacity: 0.6
                wrapMode: Text.WordWrap
            }

            Repeater {
                model: Accounts

                delegate: Controls.ItemDelegate {
                    id: accDelegate
                    required property string accountId
                    required property string name
                    required property string accountType
                    required property double balance

                    Layout.fillWidth: true
                    Layout.leftMargin: Kirigami.Units.smallSpacing
                    Layout.rightMargin: Kirigami.Units.smallSpacing
                    hoverEnabled: true
                    highlighted: drawer.activeView === "transactions" && drawer.activeFilter === ("account:" + name)
                    onClicked: drawer.selectFilter("account:" + name)

                    TapHandler {
                        acceptedButtons: Qt.RightButton
                        onTapped: accContextMenu.popup()
                    }

                    Controls.Menu {
                        id: accContextMenu

                        Controls.MenuItem {
                            text: i18n("Edit Account")
                            icon.name: "document-edit"
                            onTriggered: drawer.requestEditAccount({
                                accountId: accDelegate.accountId,
                                name: accDelegate.name,
                                accountType: accDelegate.accountType,
                                balance: accDelegate.balance
                            })
                        }

                        Controls.MenuItem {
                            text: i18n("Delete Account")
                            icon.name: "edit-delete"
                            onTriggered: drawer.requestDeleteAccount(accDelegate.accountId, accDelegate.name)
                        }
                    }

                    contentItem: RowLayout {
                        spacing: Kirigami.Units.smallSpacing

                        Kirigami.Icon {
                            source: {
                                switch (accDelegate.accountType) {
                                case "credit": return "view-financial-account-liability";
                                case "savings": return "view-financial-account-savings";
                                case "investment": return "view-financial-account-investment";
                                case "loan": return "view-financial-account-loan";
                                default: return "view-bank";
                                }
                            }
                            Layout.preferredWidth: Kirigami.Units.iconSizes.small
                            Layout.preferredHeight: Kirigami.Units.iconSizes.small
                        }

                        Controls.Label {
                            Layout.fillWidth: true
                            text: accDelegate.name
                            elide: Text.ElideRight
                        }

                        Controls.Label {
                            text: (accDelegate.balance < 0 ? "-" : "") + SettingsMgr.currencySymbol + Math.abs(accDelegate.balance).toFixed(2)
                            font.pixelSize: 11
                            font.bold: true
                            color: accDelegate.balance < 0 ? Kirigami.Theme.negativeTextColor : Kirigami.Theme.textColor
                        }

                        Controls.ToolButton {
                            visible: accDelegate.hovered
                            icon.name: "edit-delete"
                            display: Controls.AbstractButton.IconOnly
                            Controls.ToolTip.visible: hovered
                            Controls.ToolTip.text: i18n("Delete Account")
                            onClicked: drawer.requestDeleteAccount(accDelegate.accountId, accDelegate.name)
                        }
                    }
                }
            }
        }
    }

    footer: ColumnLayout {
        spacing: 0
        Layout.fillWidth: true

        Kirigami.Separator { Layout.fillWidth: true }

        Controls.ItemDelegate {
            Layout.fillWidth: true
            Layout.margins: Kirigami.Units.smallSpacing
            onClicked: drawer.openSettings()

            contentItem: RowLayout {
                spacing: Kirigami.Units.smallSpacing

                Controls.Label {
                    Layout.fillWidth: true
                    text: i18n("Settings")
                    elide: Text.ElideRight
                }

                Kirigami.Icon {
                    source: "configure"
                    Layout.preferredWidth: Kirigami.Units.iconSizes.small
                    Layout.preferredHeight: Kirigami.Units.iconSizes.small
                }
            }
        }
    }
}
