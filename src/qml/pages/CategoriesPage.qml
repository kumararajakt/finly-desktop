import QtQuick
import QtQuick.Controls as Controls
import QtQuick.Layouts
import org.kde.kirigami as Kirigami

Kirigami.ScrollablePage {
    id: page

    title: i18n("Categories")

    property string searchQuery: ""
    property string typeFilter: "all"

    signal openAddCategory()
    signal openEditCategory(var categoryData)
    signal openDeleteCategory(var categoryData)
    signal navigateToCategoryTransactions(string categoryName)

    actions: [
        Kirigami.Action {
            text: i18n("New Category")
            icon.name: "list-add"
            onTriggered: page.openAddCategory()
        }
    ]

    ColumnLayout {
        width: parent.width
        spacing: Kirigami.Units.largeSpacing

        // Search & Filter Bar
        GridLayout {
            Layout.fillWidth: true
            columns: root.isWidescreen ? 2 : 1
            columnSpacing: Kirigami.Units.smallSpacing
            rowSpacing: Kirigami.Units.smallSpacing

            Kirigami.SearchField {
                Layout.fillWidth: true
                placeholderText: i18n("Search categories...")
                onTextChanged: page.searchQuery = text.toLowerCase().trim()
            }

            Flow {
                Layout.fillWidth: !root.isWidescreen
                spacing: Kirigami.Units.smallSpacing

                Repeater {
                    model: [
                        { id: "all", label: i18n("All (%1)", Categories.count) },
                        { id: "expense", label: i18n("Expense (%1)", Categories.expenseCategoriesCount) },
                        { id: "income", label: i18n("Income (%1)", Categories.incomeCategoriesCount) }
                    ]

                    delegate: Controls.Button {
                        required property var modelData
                        text: modelData.label
                        checkable: true
                        checked: page.typeFilter === modelData.id
                        onClicked: page.typeFilter = modelData.id
                    }
                }
            }
        }

        Kirigami.PlaceholderMessage {
            visible: Categories.count === 0
            Layout.fillWidth: true
            Layout.topMargin: Kirigami.Units.gridUnit * 3
            icon.name: "tag"
            text: i18n("No categories")
            helpfulAction: Kirigami.Action {
                text: i18n("Create Category")
                icon.name: "list-add"
                onTriggered: page.openAddCategory()
            }
        }

        Kirigami.CardsLayout {
            Layout.fillWidth: true
            maximumColumns: 3
            minimumColumnWidth: Kirigami.Units.gridUnit * 14

            Repeater {
                model: Categories

                delegate: Kirigami.AbstractCard {
                    id: catCard
                    required property string categoryId
                    required property string name
                    required property string color
                    required property string categoryType
                    required property string description
                    required property int txCount
                    required property double totalSpend
                    required property double totalIncome

                    readonly property bool matchesType: page.typeFilter === "all"
                        || categoryType === page.typeFilter
                        || categoryType === "both"
                    readonly property bool matchesSearch: page.searchQuery === ""
                        || name.toLowerCase().indexOf(page.searchQuery) !== -1
                        || description.toLowerCase().indexOf(page.searchQuery) !== -1

                    visible: matchesType && matchesSearch

                    contentItem: ColumnLayout {
                        spacing: Kirigami.Units.smallSpacing

                        RowLayout {
                            Layout.fillWidth: true
                            Rectangle {
                                width: 12
                                height: 12
                                radius: 6
                                color: catCard.color || Kirigami.Theme.highlightColor
                            }
                            Controls.Label {
                                Layout.fillWidth: true
                                text: catCard.name
                                font.bold: true
                                font.pixelSize: 14
                            }
                            Controls.Label {
                                text: catCard.categoryType.toUpperCase()
                                font.pixelSize: 10
                                font.bold: true
                                opacity: 0.65
                            }
                            Controls.ToolButton {
                                icon.name: "document-edit"
                                Controls.ToolTip.visible: hovered
                                Controls.ToolTip.text: i18n("Edit Category")
                                onClicked: page.openEditCategory({
                                    id: catCard.categoryId,
                                    name: catCard.name,
                                    color: catCard.color,
                                    type: catCard.categoryType,
                                    description: catCard.description
                                })
                            }
                            Controls.ToolButton {
                                icon.name: "edit-delete"
                                Controls.ToolTip.visible: hovered
                                Controls.ToolTip.text: i18n("Delete Category")
                                onClicked: page.openDeleteCategory({
                                    id: catCard.categoryId,
                                    name: catCard.name,
                                    txCount: catCard.txCount
                                })
                            }
                        }

                        Controls.Label {
                            visible: catCard.description.length > 0
                            Layout.fillWidth: true
                            text: catCard.description
                            font.pixelSize: 11
                            opacity: 0.7
                            wrapMode: Text.WordWrap
                        }

                        RowLayout {
                            Layout.fillWidth: true
                            Controls.Label {
                                Layout.fillWidth: true
                                text: i18n("%1 transactions", catCard.txCount)
                                font.pixelSize: 11
                                opacity: 0.7
                            }
                            Controls.Label {
                                visible: catCard.totalSpend > 0
                                text: "-" + root.formatMoney(catCard.totalSpend)
                                font.pixelSize: 12
                                font.bold: true
                                color: Kirigami.Theme.negativeTextColor
                            }
                            Controls.Label {
                                visible: catCard.totalIncome > 0
                                text: "+" + root.formatMoney(catCard.totalIncome)
                                font.pixelSize: 12
                                font.bold: true
                                color: Kirigami.Theme.positiveTextColor
                            }
                        }

                        Controls.ToolButton {
                            text: i18n("View Transactions →")
                            onClicked: page.navigateToCategoryTransactions(catCard.name)
                        }
                    }
                }
            }
        }
    }
}
