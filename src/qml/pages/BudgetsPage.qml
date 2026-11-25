import QtQuick
import QtQuick.Controls as Controls
import QtQuick.Layouts
import org.kde.kirigami as Kirigami

Kirigami.ScrollablePage {
    id: page

    title: i18n("Budgets")

    property string statusFilter: "all"

    signal openAddBudget()
    signal openEditBudget(var budgetData)
    signal navigateToCategoryTransactions(string categoryName)

    actions: [
        Kirigami.Action {
            text: i18n("Create Budget")
            icon.name: "list-add"
            onTriggered: page.openAddBudget()
        }
    ]

    ColumnLayout {
        width: parent.width
        spacing: Kirigami.Units.largeSpacing

        // Overall Summary Card
        Kirigami.AbstractCard {
            Layout.fillWidth: true

            contentItem: ColumnLayout {
                spacing: Kirigami.Units.smallSpacing

                RowLayout {
                    Layout.fillWidth: true
                    spacing: Kirigami.Units.largeSpacing

                    ColumnLayout {
                        Layout.fillWidth: true
                        Controls.Label { text: i18n("TOTAL BUDGETED"); font.pixelSize: 10; font.bold: true; opacity: 0.6 }
                        Controls.Label { text: root.formatMoney(Budgets.totalBudget); font.pixelSize: 20; font.bold: true }
                    }
                    ColumnLayout {
                        Layout.fillWidth: true
                        Controls.Label { text: i18n("TOTAL SPENT"); font.pixelSize: 10; font.bold: true; opacity: 0.6 }
                        Controls.Label { text: root.formatMoney(Budgets.totalSpent); font.pixelSize: 20; font.bold: true }
                    }
                    ColumnLayout {
                        Layout.fillWidth: true
                        Controls.Label { text: i18n("REMAINING"); font.pixelSize: 10; font.bold: true; opacity: 0.6 }
                        Controls.Label {
                            text: root.formatMoney(Budgets.totalRemaining)
                            font.pixelSize: 20
                            font.bold: true
                            color: Budgets.totalRemaining < 0 ? Kirigami.Theme.negativeTextColor : Kirigami.Theme.positiveTextColor
                        }
                    }
                }

                Controls.ProgressBar {
                    Layout.fillWidth: true
                    from: 0
                    to: 100
                    value: Budgets.overallPercentage
                }
            }
        }

        // Status Filter Tabs
        Flow {
            Layout.fillWidth: true
            spacing: Kirigami.Units.smallSpacing

            Repeater {
                model: [
                    { id: "all", label: i18n("All (%1)", Budgets.count) },
                    { id: "healthy", label: i18n("Healthy (%1)", Budgets.healthyCount) },
                    { id: "warning", label: i18n("Warning (%1)", Budgets.warningCount) },
                    { id: "over", label: i18n("Over Budget (%1)", Budgets.overCount) }
                ]

                delegate: Controls.Button {
                    required property var modelData
                    text: modelData.label
                    checkable: true
                    checked: page.statusFilter === modelData.id
                    onClicked: page.statusFilter = modelData.id
                }
            }
        }

        // Empty State
        Kirigami.PlaceholderMessage {
            visible: Budgets.count === 0
            Layout.fillWidth: true
            Layout.topMargin: Kirigami.Units.gridUnit * 3
            icon.name: "office-chart-pie"
            text: i18n("No budgets configured")
            explanation: i18n("Set monthly spending limits for your categories to track progress.")
            helpfulAction: Kirigami.Action {
                text: i18n("Create First Budget")
                icon.name: "list-add"
                onTriggered: page.openAddBudget()
            }
        }

        // Budget Cards Grid
        Kirigami.CardsLayout {
            Layout.fillWidth: true
            maximumColumns: 3
            minimumColumnWidth: Kirigami.Units.gridUnit * 14

            Repeater {
                model: Budgets

                delegate: Kirigami.AbstractCard {
                    id: bCard
                    required property string budgetId
                    required property string category
                    required property double limit
                    required property string period
                    required property string color
                    required property double spent
                    required property double remaining
                    required property int percentage
                    required property string status

                    visible: page.statusFilter === "all" || page.statusFilter === status

                    contentItem: ColumnLayout {
                        spacing: Kirigami.Units.smallSpacing

                        RowLayout {
                            Layout.fillWidth: true
                            Rectangle {
                                width: 12
                                height: 12
                                radius: 6
                                color: bCard.color || Kirigami.Theme.highlightColor
                            }
                            Controls.Label {
                                Layout.fillWidth: true
                                text: bCard.category
                                font.bold: true
                                font.pixelSize: 14
                            }
                            Controls.ToolButton {
                                icon.name: "document-edit"
                                Controls.ToolTip.visible: hovered
                                Controls.ToolTip.text: i18n("Edit Limit")
                                onClicked: page.openEditBudget({
                                    id: bCard.budgetId,
                                    category: bCard.category,
                                    limit: bCard.limit,
                                    color: bCard.color,
                                    period: bCard.period
                                })
                            }
                            Controls.ToolButton {
                                icon.name: "edit-delete"
                                Controls.ToolTip.visible: hovered
                                Controls.ToolTip.text: i18n("Delete Budget")
                                onClicked: Budgets.deleteBudget(bCard.budgetId)
                            }
                        }

                        Controls.ProgressBar {
                            Layout.fillWidth: true
                            from: 0
                            to: 100
                            value: Math.min(100, bCard.percentage)
                        }

                        RowLayout {
                            Layout.fillWidth: true
                            Controls.Label {
                                Layout.fillWidth: true
                                text: i18n("%1 of %2 (%3%)", root.formatMoney(bCard.spent), root.formatMoney(bCard.limit), bCard.percentage)
                                font.pixelSize: 12
                            }
                            Controls.Label {
                                text: bCard.status === "over"
                                    ? i18n("Over by %1", root.formatMoney(Math.abs(bCard.remaining)))
                                    : i18n("%1 left", root.formatMoney(bCard.remaining))
                                font.pixelSize: 12
                                font.bold: true
                                color: bCard.status === "over"
                                    ? Kirigami.Theme.negativeTextColor
                                    : (bCard.status === "warning" ? Kirigami.Theme.neutralTextColor : Kirigami.Theme.positiveTextColor)
                            }
                        }

                        Controls.ToolButton {
                            text: i18n("View Transactions →")
                            onClicked: page.navigateToCategoryTransactions(bCard.category)
                        }
                    }
                }
            }
        }
    }
}
