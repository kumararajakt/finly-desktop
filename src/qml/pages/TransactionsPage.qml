import QtQuick
import QtQuick.Controls as Controls
import QtQuick.Layouts
import org.kde.kirigami as Kirigami

Kirigami.ScrollablePage {
    id: page

    title: i18n("Transactions")

    property bool showFilters: false
    property var selectedIds: []
    property string sortField: "date"
    property bool sortAscending: false

    signal openAddTransaction()
    signal openEditTransaction(var txData)
    signal openImportCSV()
    signal exportCSV()
    signal openAskFinly(string prompt)

    actions: [
        Kirigami.Action {
            text: TransactionFilter.activeFiltersCount > 0
                ? i18n("Filters (%1)", TransactionFilter.activeFiltersCount)
                : i18n("Filters")
            icon.name: "view-filter"
            checkable: true
            checked: page.showFilters
            onTriggered: page.showFilters = !page.showFilters
        },
        Kirigami.Action {
            text: i18n("Import CSV")
            icon.name: "document-import"
            onTriggered: page.openImportCSV()
        },
        Kirigami.Action {
            text: i18n("Export CSV")
            icon.name: "document-export"
            enabled: TransactionFilter.filteredCount > 0
            onTriggered: page.exportCSV()
        },
        Kirigami.Action {
            text: i18n("New Transaction")
            icon.name: "list-add"
            onTriggered: page.openAddTransaction()
        }
    ]

    function toggleSort(field) {
        if (page.sortField === field) {
            page.sortAscending = !page.sortAscending;
        } else {
            page.sortField = field;
            page.sortAscending = (field !== "date");
        }
        TransactionFilter.sortByField(page.sortField, page.sortAscending);
    }

    function isSelected(txId) {
        return page.selectedIds.indexOf(txId) !== -1;
    }

    function toggleRowSelection(txId) {
        var copy = page.selectedIds.slice();
        var idx = copy.indexOf(txId);
        if (idx === -1) {
            copy.push(txId);
        } else {
            copy.splice(idx, 1);
        }
        page.selectedIds = copy;
    }

    ColumnLayout {
        width: parent.width
        spacing: Kirigami.Units.mediumSpacing

        // Search & Segmented Filter Tabs (responsive: single row on widescreen, stacked/wrapped on mobile)
        GridLayout {
            Layout.fillWidth: true
            columns: root.isWidescreen ? 2 : 1
            columnSpacing: Kirigami.Units.smallSpacing
            rowSpacing: Kirigami.Units.smallSpacing

            Kirigami.SearchField {
                Layout.fillWidth: true
                placeholderText: i18n("Search transactions...")
                text: TransactionFilter.searchQuery
                onTextChanged: TransactionFilter.searchQuery = text
            }

            Flow {
                Layout.fillWidth: !root.isWidescreen
                spacing: Kirigami.Units.smallSpacing

                Repeater {
                    model: [
                        { id: "all", label: i18n("All") },
                        { id: "expense", label: i18n("Expenses") },
                        { id: "income", label: i18n("Income") },
                        { id: "transfer", label: i18n("Transfers") },
                        { id: "pending", label: i18n("Pending") },
                        { id: "flagged", label: i18n("Flagged") }
                    ]

                    delegate: Controls.Button {
                        required property var modelData
                        text: modelData.label
                        checkable: true
                        checked: TransactionFilter.activeFilter === modelData.id
                        onClicked: {
                            root.activeFilter = modelData.id;
                            TransactionFilter.activeFilter = modelData.id;
                        }
                    }
                }
            }
        }

        // Collapsible Advanced Filters Panel
        Kirigami.AbstractCard {
            visible: page.showFilters
            Layout.fillWidth: true

            contentItem: ColumnLayout {
                spacing: Kirigami.Units.smallSpacing

                RowLayout {
                    Layout.fillWidth: true
                    Controls.Label {
                        Layout.fillWidth: true
                        text: i18n("Advanced Filters")
                        font.bold: true
                    }
                    Controls.ToolButton {
                        visible: TransactionFilter.activeFiltersCount > 0
                        text: i18n("Reset all filters")
                        onClicked: TransactionFilter.clearAllFilters()
                    }
                    Controls.ToolButton {
                        icon.name: "window-close"
                        onClicked: page.showFilters = false
                    }
                }

                GridLayout {
                    Layout.fillWidth: true
                    columns: root.isWidescreen ? 4 : (page.width > 480 ? 2 : 1)
                    columnSpacing: Kirigami.Units.mediumSpacing
                    rowSpacing: Kirigami.Units.smallSpacing

                    ColumnLayout {
                        Layout.fillWidth: true
                        Controls.Label { text: i18n("Account"); font.pixelSize: 11; opacity: 0.7 }
                        Controls.ComboBox {
                            Layout.fillWidth: true
                            model: [""].concat(Accounts.accountNames())
                            displayText: currentText === "" ? i18n("All Accounts") : currentText
                            onActivated: TransactionFilter.filterAccount = currentText
                        }
                    }

                    ColumnLayout {
                        Layout.fillWidth: true
                        Controls.Label { text: i18n("Category"); font.pixelSize: 11; opacity: 0.7 }
                        Controls.ComboBox {
                            Layout.fillWidth: true
                            model: [""].concat(Categories.categoryNames())
                            displayText: currentText === "" ? i18n("All Categories") : currentText
                            onActivated: TransactionFilter.filterCategory = currentText
                        }
                    }

                    ColumnLayout {
                        Layout.fillWidth: true
                        Controls.Label { text: i18n("Date Range"); font.pixelSize: 11; opacity: 0.7 }
                        Controls.ComboBox {
                            Layout.fillWidth: true
                            textRole: "label"
                            valueRole: "id"
                            model: [
                                { id: "all", label: i18n("All Time") },
                                { id: "this_month", label: i18n("This Month") },
                                { id: "last_month", label: i18n("Last Month") },
                                { id: "last_30_days", label: i18n("Last 30 Days") },
                                { id: "this_year", label: i18n("This Year") },
                                { id: "custom", label: i18n("Custom Range") }
                            ]
                            onActivated: TransactionFilter.datePreset = currentValue
                        }
                    }

                    ColumnLayout {
                        Layout.fillWidth: true
                        Controls.Label { text: i18n("Amount Range"); font.pixelSize: 11; opacity: 0.7 }
                        RowLayout {
                            Layout.fillWidth: true
                            Controls.TextField {
                                Layout.fillWidth: true
                                placeholderText: i18n("Min")
                                validator: DoubleValidator {}
                                text: TransactionFilter.minAmount
                                onTextChanged: TransactionFilter.minAmount = text
                            }
                            Controls.TextField {
                                Layout.fillWidth: true
                                placeholderText: i18n("Max")
                                validator: DoubleValidator {}
                                text: TransactionFilter.maxAmount
                                onTextChanged: TransactionFilter.maxAmount = text
                            }
                        }
                    }
                }

                // Custom Date Inputs
                RowLayout {
                    visible: TransactionFilter.datePreset === "custom"
                    Layout.fillWidth: true
                    spacing: Kirigami.Units.mediumSpacing

                    Controls.Label { text: i18n("Start Date (YYYY-MM-DD):"); font.pixelSize: 11 }
                    Controls.TextField {
                        placeholderText: "2026-01-01"
                        text: TransactionFilter.customStartDate
                        onTextChanged: TransactionFilter.customStartDate = text
                    }
                    Controls.Label { text: i18n("End Date (YYYY-MM-DD):"); font.pixelSize: 11 }
                    Controls.TextField {
                        placeholderText: "2026-12-31"
                        text: TransactionFilter.customEndDate
                        onTextChanged: TransactionFilter.customEndDate = text
                    }
                }
            }
        }

        // Multi-Select Bar
        Kirigami.InlineMessage {
            visible: page.selectedIds.length > 0
            Layout.fillWidth: true
            type: Kirigami.MessageType.Information
            text: i18n("%1 transaction(s) selected", page.selectedIds.length)
            actions: [
                Kirigami.Action {
                    visible: SettingsMgr.aiEnabled
                    text: i18n("Ask Finly about %1 selected", page.selectedIds.length)
                    icon.name: "quickopen"
                    onTriggered: page.openAskFinly(i18n("Review my %1 selected transactions.", page.selectedIds.length))
                },
                Kirigami.Action {
                    text: i18n("Clear")
                    icon.name: "edit-clear"
                    onTriggered: page.selectedIds = []
                }
            ]
        }

        // Empty State
        Kirigami.PlaceholderMessage {
            visible: TransactionFilter.filteredCount === 0
            Layout.fillWidth: true
            Layout.topMargin: Kirigami.Units.gridUnit * 3
            icon.name: "view-list-details"
            text: Transactions.count === 0 ? i18n("No transactions yet") : i18n("No matching transactions")
            explanation: Transactions.count === 0
                ? i18n("Add a transaction manually or import a CSV bank statement.")
                : i18n("Try adjusting your search or filter criteria.")
            helpfulAction: Kirigami.Action {
                text: i18n("Add Transaction")
                icon.name: "list-add"
                onTriggered: page.openAddTransaction()
            }
        }

        // Table Card
        Kirigami.AbstractCard {
            id: tableCard
            visible: TransactionFilter.filteredCount > 0
            Layout.fillWidth: true

            readonly property int colCheckW: 32
            readonly property int colDateW: 96
            readonly property int colCatW: 140
            readonly property int colAccW: 150
            readonly property int colAmtW: 130
            readonly property int colStatusW: 90
            readonly property int colActionsW: SettingsMgr.aiEnabled ? 132 : 98

            contentItem: ColumnLayout {
                spacing: 0

                RowLayout {
                    visible: root.isWidescreen
                    Layout.fillWidth: true
                    spacing: Kirigami.Units.smallSpacing

                    Controls.CheckBox {
                        Layout.preferredWidth: tableCard.colCheckW
                        Layout.minimumWidth: tableCard.colCheckW
                        Layout.maximumWidth: tableCard.colCheckW
                        checked: page.selectedIds.length > 0 && page.selectedIds.length === TransactionFilter.filteredCount
                        onToggled: {
                            if (checked) {
                                var all = [];
                                for (var i = 0; i < TransactionFilter.filteredCount; ++i) {
                                    all.push(TransactionFilter.data(TransactionFilter.index(i, 0), Qt.UserRole + 1));
                                }
                                page.selectedIds = all;
                            } else {
                                page.selectedIds = [];
                            }
                        }
                    }
                    Controls.ToolButton {
                        text: i18n("Date") + (page.sortField === "date" ? (page.sortAscending ? " ↑" : " ↓") : "")
                        font.bold: true
                        Layout.preferredWidth: tableCard.colDateW
                        Layout.minimumWidth: tableCard.colDateW
                        Layout.maximumWidth: tableCard.colDateW
                        onClicked: page.toggleSort("date")
                    }
                    Controls.ToolButton {
                        text: i18n("Payee") + (page.sortField === "payee" ? (page.sortAscending ? " ↑" : " ↓") : "")
                        font.bold: true
                        Layout.fillWidth: true
                        Layout.minimumWidth: 140
                        Layout.preferredWidth: 100
                        onClicked: page.toggleSort("payee")
                    }
                    Controls.ToolButton {
                        text: i18n("Category") + (page.sortField === "category" ? (page.sortAscending ? " ↑" : " ↓") : "")
                        font.bold: true
                        Layout.preferredWidth: tableCard.colCatW
                        Layout.minimumWidth: tableCard.colCatW
                        Layout.maximumWidth: tableCard.colCatW
                        onClicked: page.toggleSort("category")
                    }
                    Controls.Label {
                        text: i18n("Account")
                        font.bold: true
                        Layout.preferredWidth: tableCard.colAccW
                        Layout.minimumWidth: tableCard.colAccW
                        Layout.maximumWidth: tableCard.colAccW
                    }
                    Controls.ToolButton {
                        text: i18n("Amount") + (page.sortField === "amount" ? (page.sortAscending ? " ↑" : " ↓") : "")
                        font.bold: true
                        Layout.preferredWidth: tableCard.colAmtW
                        Layout.minimumWidth: tableCard.colAmtW
                        Layout.maximumWidth: tableCard.colAmtW
                        onClicked: page.toggleSort("amount")
                    }
                    Controls.ToolButton {
                        text: i18n("Status") + (page.sortField === "status" ? (page.sortAscending ? " ↑" : " ↓") : "")
                        font.bold: true
                        Layout.preferredWidth: tableCard.colStatusW
                        Layout.minimumWidth: tableCard.colStatusW
                        Layout.maximumWidth: tableCard.colStatusW
                        onClicked: page.toggleSort("status")
                    }
                    Item {
                        Layout.preferredWidth: tableCard.colActionsW
                        Layout.minimumWidth: tableCard.colActionsW
                        Layout.maximumWidth: tableCard.colActionsW
                    }
                }

                Kirigami.Separator {
                    visible: root.isWidescreen
                    Layout.fillWidth: true
                }

                Repeater {
                    model: TransactionFilter

                    delegate: ColumnLayout {
                        id: txRow
                        required property string txId
                        required property string date
                        required property string payee
                        required property string category
                        required property string categoryColor
                        required property string account
                        required property string toAccount
                        required property double amount
                        required property string txType
                        required property string status
                        required property string notes

                        Layout.fillWidth: true
                        spacing: 0

                        // Desktop Table Row
                        RowLayout {
                            visible: root.isWidescreen
                            Layout.fillWidth: true
                            Layout.topMargin: 6
                            Layout.bottomMargin: 6
                            spacing: Kirigami.Units.smallSpacing

                            Controls.CheckBox {
                                Layout.preferredWidth: tableCard.colCheckW
                                Layout.minimumWidth: tableCard.colCheckW
                                Layout.maximumWidth: tableCard.colCheckW
                                checked: page.isSelected(txRow.txId)
                                onToggled: page.toggleRowSelection(txRow.txId)
                            }

                            Controls.Label {
                                text: txRow.date
                                font.pixelSize: 12
                                Layout.preferredWidth: tableCard.colDateW
                                Layout.minimumWidth: tableCard.colDateW
                                Layout.maximumWidth: tableCard.colDateW
                            }

                            ColumnLayout {
                                Layout.fillWidth: true
                                Layout.minimumWidth: 140
                                Layout.preferredWidth: 100
                                spacing: 0
                                Controls.Label {
                                    Layout.fillWidth: true
                                    text: txRow.payee
                                    font.bold: true
                                    elide: Text.ElideRight
                                }
                                Controls.Label {
                                    visible: txRow.notes.length > 0
                                    Layout.fillWidth: true
                                    text: txRow.notes
                                    font.pixelSize: 10
                                    opacity: 0.65
                                    elide: Text.ElideRight
                                }
                            }

                            RowLayout {
                                Layout.preferredWidth: tableCard.colCatW
                                Layout.minimumWidth: tableCard.colCatW
                                Layout.maximumWidth: tableCard.colCatW
                                spacing: 6
                                Rectangle {
                                    width: 8
                                    height: 8
                                    radius: 4
                                    color: txRow.categoryColor || Kirigami.Theme.highlightColor
                                }
                                Controls.Label {
                                    Layout.fillWidth: true
                                    text: txRow.category
                                    font.pixelSize: 12
                                    elide: Text.ElideRight
                                }
                            }

                            Controls.Label {
                                Layout.preferredWidth: tableCard.colAccW
                                Layout.minimumWidth: tableCard.colAccW
                                Layout.maximumWidth: tableCard.colAccW
                                text: txRow.txType === "transfer" && txRow.toAccount.length > 0
                                    ? txRow.account + " → " + txRow.toAccount
                                    : txRow.account
                                font.pixelSize: 12
                                opacity: 0.8
                                elide: Text.ElideRight
                            }

                            Controls.Label {
                                Layout.preferredWidth: tableCard.colAmtW
                                Layout.minimumWidth: tableCard.colAmtW
                                Layout.maximumWidth: tableCard.colAmtW
                                horizontalAlignment: Text.AlignRight
                                rightPadding: 8
                                text: (txRow.amount > 0 && txRow.txType !== "transfer" ? "+" : "") + root.formatMoney(txRow.amount)
                                font.bold: true
                                elide: Text.ElideRight
                                color: txRow.txType === "transfer"
                                    ? Kirigami.Theme.textColor
                                    : (txRow.amount >= 0 ? Kirigami.Theme.positiveTextColor : Kirigami.Theme.negativeTextColor)
                            }

                            Controls.Label {
                                Layout.preferredWidth: tableCard.colStatusW
                                Layout.minimumWidth: tableCard.colStatusW
                                Layout.maximumWidth: tableCard.colStatusW
                                horizontalAlignment: Text.AlignHCenter
                                text: txRow.status.toUpperCase()
                                font.pixelSize: 10
                                font.bold: true
                                color: txRow.status === "flagged"
                                    ? Kirigami.Theme.neutralTextColor
                                    : (txRow.status === "pending" ? Kirigami.Theme.disabledTextColor : Kirigami.Theme.positiveTextColor)
                            }

                            RowLayout {
                                Layout.preferredWidth: tableCard.colActionsW
                                Layout.minimumWidth: tableCard.colActionsW
                                Layout.maximumWidth: tableCard.colActionsW
                                spacing: 2

                                Controls.ToolButton {
                                    visible: SettingsMgr.aiEnabled
                                    icon.name: "quickopen"
                                    Controls.ToolTip.visible: hovered
                                    Controls.ToolTip.text: i18n("Review with Finly AI")
                                    onClicked: page.openAskFinly(i18n("Review transaction at %1 for %2", txRow.payee, root.formatMoney(Math.abs(txRow.amount))))
                                }

                                Controls.ToolButton {
                                    icon.name: "document-edit"
                                    Controls.ToolTip.visible: hovered
                                    Controls.ToolTip.text: i18n("Edit Transaction")
                                    onClicked: page.openEditTransaction({
                                        id: txRow.txId,
                                        date: txRow.date,
                                        payee: txRow.payee,
                                        category: txRow.category,
                                        categoryColor: txRow.categoryColor,
                                        account: txRow.account,
                                        toAccount: txRow.toAccount,
                                        amount: txRow.amount,
                                        type: txRow.txType,
                                        status: txRow.status,
                                        notes: txRow.notes
                                    })
                                }

                                Controls.ToolButton {
                                    icon.name: "flag"
                                    Controls.ToolTip.visible: hovered
                                    Controls.ToolTip.text: txRow.status === "flagged" ? i18n("Unflag") : i18n("Flag")
                                    onClicked: Transactions.toggleFlagTransaction(txRow.txId)
                                }

                                Controls.ToolButton {
                                    icon.name: "edit-delete"
                                    Controls.ToolTip.visible: hovered
                                    Controls.ToolTip.text: i18n("Delete Transaction")
                                    onClicked: Transactions.deleteTransaction(txRow.txId)
                                }
                            }
                        }

                        // Mobile / Narrow Compact Row
                        ColumnLayout {
                            visible: !root.isWidescreen
                            Layout.fillWidth: true
                            Layout.topMargin: 8
                            Layout.bottomMargin: 8
                            spacing: 4

                            RowLayout {
                                Layout.fillWidth: true
                                spacing: Kirigami.Units.smallSpacing

                                Controls.CheckBox {
                                    checked: page.isSelected(txRow.txId)
                                    onToggled: page.toggleRowSelection(txRow.txId)
                                }
                                Controls.Label {
                                    Layout.fillWidth: true
                                    text: txRow.payee
                                    font.bold: true
                                    elide: Text.ElideRight
                                }
                                Controls.Label {
                                    text: (txRow.amount > 0 && txRow.txType !== "transfer" ? "+" : "") + root.formatMoney(txRow.amount)
                                    font.bold: true
                                    color: txRow.txType === "transfer"
                                        ? Kirigami.Theme.textColor
                                        : (txRow.amount >= 0 ? Kirigami.Theme.positiveTextColor : Kirigami.Theme.negativeTextColor)
                                }
                            }

                            RowLayout {
                                Layout.fillWidth: true
                                Layout.leftMargin: 32
                                spacing: Kirigami.Units.smallSpacing

                                Controls.Label {
                                    text: txRow.date + " · " + txRow.category + " · " + txRow.account
                                    font.pixelSize: 11
                                    opacity: 0.75
                                    Layout.fillWidth: true
                                    elide: Text.ElideRight
                                }
                                Controls.ToolButton {
                                    icon.name: "document-edit"
                                    onClicked: page.openEditTransaction({
                                        id: txRow.txId,
                                        date: txRow.date,
                                        payee: txRow.payee,
                                        category: txRow.category,
                                        categoryColor: txRow.categoryColor,
                                        account: txRow.account,
                                        toAccount: txRow.toAccount,
                                        amount: txRow.amount,
                                        type: txRow.txType,
                                        status: txRow.status,
                                        notes: txRow.notes
                                    })
                                }
                                Controls.ToolButton {
                                    icon.name: "flag"
                                    onClicked: Transactions.toggleFlagTransaction(txRow.txId)
                                }
                                Controls.ToolButton {
                                    icon.name: "edit-delete"
                                    onClicked: Transactions.deleteTransaction(txRow.txId)
                                }
                            }
                        }

                        Kirigami.Separator {
                    visible: root.isWidescreen
                    Layout.fillWidth: true
                }
                    }
                }
            }
        }
    }
}
