import QtQuick
import QtQuick.Controls as Controls
import QtQuick.Layouts
import org.kde.kirigami as Kirigami

Kirigami.ScrollablePage {
    id: page

    title: i18n("Dashboard")

    signal navigateToTransactions(string filterId)
    signal openAddTransaction()
    signal openAddAccount()
    signal openAskFinly(string prompt)
    signal requestEditAccount(var accountData)
    signal requestDeleteAccount(string accountId, string accountName)

    actions: [
        Kirigami.Action {
            text: i18n("Add Account")
            icon.name: "list-add"
            onTriggered: page.openAddAccount()
        },
        Kirigami.Action {
            text: i18n("New Transaction")
            icon.name: "document-new"
            onTriggered: page.openAddTransaction()
        }
    ]

    property bool digestCollapsed: false
    property string digestText: ""

    Connections {
        target: AiSvc
        function onDigestGenerated(summary, error) {
            if (error && error.length > 0) {
                page.digestText = i18n("Error generating digest: %1", error);
            } else {
                page.digestText = summary;
            }
        }
    }

    ColumnLayout {
        width: parent.width
        spacing: Kirigami.Units.largeSpacing

        // Top KPI Row
        Kirigami.CardsLayout {
            Layout.fillWidth: true
            maximumColumns: 4
            minimumColumnWidth: Kirigami.Units.gridUnit * 12

            // Net Worth Card
            Kirigami.AbstractCard {
                contentItem: ColumnLayout {
                    spacing: Kirigami.Units.smallSpacing
                    Controls.Label {
                        text: i18n("TOTAL NET WORTH")
                        font.pixelSize: 10
                        font.bold: true
                        opacity: 0.6
                    }
                    Controls.Label {
                        text: root.formatMoney(Accounts.totalNetWorth)
                        font.pixelSize: 22
                        font.bold: true
                        color: Accounts.totalNetWorth < 0 ? Kirigami.Theme.negativeTextColor : Kirigami.Theme.textColor
                    }
                    RowLayout {
                        spacing: Kirigami.Units.largeSpacing
                        Controls.Label {
                            text: i18n("Assets: %1", root.formatMoney(Accounts.totalAssets))
                            font.pixelSize: 11
                            color: Kirigami.Theme.positiveTextColor
                        }
                        Controls.Label {
                            text: i18n("Debt: %1", root.formatMoney(Accounts.totalLiabilities))
                            font.pixelSize: 11
                            color: Kirigami.Theme.negativeTextColor
                        }
                    }
                }
            }

            // Inflow Card
            Kirigami.AbstractCard {
                contentItem: ColumnLayout {
                    spacing: Kirigami.Units.smallSpacing
                    Controls.Label {
                        text: i18n("TOTAL INFLOW")
                        font.pixelSize: 10
                        font.bold: true
                        opacity: 0.6
                    }
                    Controls.Label {
                        text: root.formatMoney(Transactions.totalInflow)
                        font.pixelSize: 22
                        font.bold: true
                        color: Kirigami.Theme.positiveTextColor
                    }
                    Controls.Label {
                        text: i18n("Excludes transfers")
                        font.pixelSize: 11
                        opacity: 0.6
                    }
                }
            }

            // Outflow Card
            Kirigami.AbstractCard {
                contentItem: ColumnLayout {
                    spacing: Kirigami.Units.smallSpacing
                    Controls.Label {
                        text: i18n("TOTAL OUTFLOW")
                        font.pixelSize: 10
                        font.bold: true
                        opacity: 0.6
                    }
                    Controls.Label {
                        text: root.formatMoney(Transactions.totalOutflow)
                        font.pixelSize: 22
                        font.bold: true
                        color: Kirigami.Theme.negativeTextColor
                    }
                    Controls.Label {
                        text: i18n("Savings Rate: %1%", Transactions.savingsRate.toFixed(1))
                        font.pixelSize: 11
                        opacity: 0.75
                    }
                }
            }

            // Attention / Status Card
            Kirigami.AbstractCard {
                contentItem: ColumnLayout {
                    spacing: Kirigami.Units.smallSpacing
                    Controls.Label {
                        text: i18n("NEEDS ATTENTION")
                        font.pixelSize: 10
                        font.bold: true
                        opacity: 0.6
                    }
                    RowLayout {
                        spacing: Kirigami.Units.largeSpacing
                        Controls.ToolButton {
                            text: i18n("%1 Pending", Transactions.pendingCount)
                            icon.name: "chronometer"
                            onClicked: page.navigateToTransactions("pending")
                        }
                        Controls.ToolButton {
                            text: i18n("%1 Flagged", Transactions.flaggedCount)
                            icon.name: "flag"
                            onClicked: page.navigateToTransactions("flagged")
                        }
                    }
                    Controls.Label {
                        text: i18n("Net Cash Flow: %1", root.formatMoney(Transactions.netCashFlow))
                        font.pixelSize: 11
                        color: Transactions.netCashFlow >= 0 ? Kirigami.Theme.positiveTextColor : Kirigami.Theme.negativeTextColor
                    }
                }
            }
        }

        // Conditional AI Financial Health Digest
        Kirigami.AbstractCard {
            visible: SettingsMgr.aiEnabled
            Layout.fillWidth: true

            contentItem: ColumnLayout {
                spacing: Kirigami.Units.smallSpacing

                RowLayout {
                    Layout.fillWidth: true
                    spacing: Kirigami.Units.smallSpacing

                    Kirigami.Icon {
                        source: "quickopen"
                        Layout.preferredWidth: Kirigami.Units.iconSizes.smallMedium
                        Layout.preferredHeight: Kirigami.Units.iconSizes.smallMedium
                    }

                    Controls.Label {
                        Layout.fillWidth: true
                        text: i18n("AI Financial Health Digest")
                        font.bold: true
                        font.pixelSize: 14
                    }

                    Controls.ToolButton {
                        text: AiSvc.busy ? i18n("Generating...") : i18n("Refresh")
                        icon.name: "view-refresh"
                        enabled: !AiSvc.busy
                        onClicked: AiSvc.generateHealthDigest()
                    }

                    Controls.ToolButton {
                        text: i18n("Ask Finly")
                        icon.name: "document-edit"
                        onClicked: page.openAskFinly(i18n("Provide a full breakdown of my financial health digest."))
                    }

                    Controls.ToolButton {
                        icon.name: page.digestCollapsed ? "arrow-down" : "arrow-up"
                        onClicked: page.digestCollapsed = !page.digestCollapsed
                    }
                }

                Controls.Label {
                    visible: !page.digestCollapsed
                    Layout.fillWidth: true
                    text: page.digestText.length > 0
                        ? page.digestText
                        : i18n("Click Refresh to generate an AI summary of your spending trends, budgets, and savings rate.")
                    wrapMode: Text.WordWrap
                    opacity: page.digestText.length > 0 ? 0.95 : 0.75
                }
            }
        }

        // Two-column section: Category Breakdown & Accounts
        GridLayout {
            Layout.fillWidth: true
            columns: page.width > 900 ? 2 : 1
            columnSpacing: Kirigami.Units.largeSpacing
            rowSpacing: Kirigami.Units.largeSpacing

            // Category Breakdown
            Kirigami.AbstractCard {
                Layout.fillWidth: true
                Layout.fillHeight: true

                contentItem: ColumnLayout {
                    spacing: Kirigami.Units.mediumSpacing

                    Controls.Label {
                        text: i18n("Expense Breakdown by Category")
                        font.bold: true
                        font.pixelSize: 14
                    }

                    Controls.Label {
                        visible: Transactions.categoryBreakdown().length === 0
                        text: i18n("No expenses recorded yet.")
                        opacity: 0.6
                    }

                    Repeater {
                        model: Transactions.categoryBreakdown()

                        delegate: ColumnLayout {
                            required property var modelData
                            Layout.fillWidth: true
                            spacing: 4

                            RowLayout {
                                Layout.fillWidth: true
                                Rectangle {
                                    width: 10
                                    height: 10
                                    radius: 5
                                    color: modelData.color || Kirigami.Theme.highlightColor
                                }
                                Controls.Label {
                                    Layout.fillWidth: true
                                    text: modelData.name
                                    font.bold: true
                                }
                                Controls.Label {
                                    text: root.formatMoney(modelData.amount) + " (" + modelData.percentage + "%)"
                                    font.pixelSize: 12
                                    opacity: 0.8
                                }
                            }

                            Controls.ProgressBar {
                                Layout.fillWidth: true
                                from: 0
                                to: 100
                                value: modelData.percentage
                            }
                        }
                    }

                    Item { Layout.fillHeight: true }
                }
            }

            // Accounts Summary
            Kirigami.AbstractCard {
                Layout.fillWidth: true
                Layout.fillHeight: true

                contentItem: ColumnLayout {
                    spacing: Kirigami.Units.mediumSpacing

                    RowLayout {
                        Layout.fillWidth: true
                        Controls.Label {
                            Layout.fillWidth: true
                            text: i18n("Accounts")
                            font.bold: true
                            font.pixelSize: 14
                        }
                        Controls.ToolButton {
                            text: i18n("+ Add")
                            onClicked: page.openAddAccount()
                        }
                    }

                    Controls.Label {
                        visible: Accounts.count === 0
                        text: i18n("No accounts added yet.")
                        opacity: 0.6
                    }

                    Repeater {
                        model: Accounts

                        delegate: Controls.ItemDelegate {
                            id: dashAccDelegate
                            required property string accountId
                            required property string name
                            required property string accountType
                            required property double balance

                            Layout.fillWidth: true
                            onClicked: page.navigateToTransactions("account:" + name)

                            TapHandler {
                                acceptedButtons: Qt.RightButton
                                onTapped: dashAccContextMenu.popup()
                            }

                            Controls.Menu {
                                id: dashAccContextMenu

                                Controls.MenuItem {
                                    text: i18n("Edit Account")
                                    icon.name: "document-edit"
                                    onTriggered: page.requestEditAccount({
                                        accountId: dashAccDelegate.accountId,
                                        name: dashAccDelegate.name,
                                        accountType: dashAccDelegate.accountType,
                                        balance: dashAccDelegate.balance
                                    })
                                }

                                Controls.MenuItem {
                                    text: i18n("Delete Account")
                                    icon.name: "edit-delete"
                                    onTriggered: page.requestDeleteAccount(dashAccDelegate.accountId, dashAccDelegate.name)
                                }
                            }

                            contentItem: RowLayout {
                                spacing: Kirigami.Units.smallSpacing
                                Kirigami.Icon {
                                    source: {
                                        switch (accountType) {
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
                                    text: name
                                }
                                Controls.Label {
                                    text: root.formatMoney(balance)
                                    font.bold: true
                                    color: balance < 0 ? Kirigami.Theme.negativeTextColor : Kirigami.Theme.textColor
                                }
                            }
                        }
                    }

                    Item { Layout.fillHeight: true }
                }
            }
        }

        // Recent Transactions
        Kirigami.AbstractCard {
            Layout.fillWidth: true

            contentItem: ColumnLayout {
                spacing: Kirigami.Units.mediumSpacing

                RowLayout {
                    Layout.fillWidth: true
                    Controls.Label {
                        Layout.fillWidth: true
                        text: i18n("Recent Transactions")
                        font.bold: true
                        font.pixelSize: 14
                    }
                    Controls.ToolButton {
                        text: i18n("View All →")
                        onClicked: page.navigateToTransactions("all")
                    }
                }

                Controls.Label {
                    visible: Transactions.count === 0
                    text: i18n("No transactions yet. Click New Transaction to record your first entry.")
                    opacity: 0.6
                }

                Repeater {
                    model: Transactions

                    delegate: Controls.ItemDelegate {
                        required property int index
                        required property string date
                        required property string payee
                        required property string category
                        required property string account
                        required property double amount
                        required property string txType

                        visible: index < 8
                        Layout.fillWidth: true
                        onClicked: page.navigateToTransactions("all")

                        contentItem: RowLayout {
                            spacing: Kirigami.Units.mediumSpacing
                            Controls.Label {
                                text: date
                                font.pixelSize: 11
                                opacity: 0.65
                                Layout.preferredWidth: 85
                            }
                            Controls.Label {
                                Layout.fillWidth: true
                                text: payee
                                font.bold: true
                                elide: Text.ElideRight
                            }
                            Controls.Label {
                                text: category
                                font.pixelSize: 11
                                opacity: 0.75
                            }
                            Controls.Label {
                                text: account
                                font.pixelSize: 11
                                opacity: 0.65
                            }
                            Controls.Label {
                                text: (amount > 0 && txType !== "transfer" ? "+" : "") + root.formatMoney(amount)
                                font.bold: true
                                color: txType === "transfer"
                                    ? Kirigami.Theme.textColor
                                    : (amount >= 0 ? Kirigami.Theme.positiveTextColor : Kirigami.Theme.negativeTextColor)
                            }
                        }
                    }
                }
            }
        }
    }
}
