import QtQuick
import QtQuick.Controls as Controls
import QtQuick.Layouts
import org.kde.kirigami as Kirigami

Kirigami.ScrollablePage {
    id: page

    title: i18n("Loans & Debts")

    property string searchQuery: ""
    property string activeFilter: "all"
    property string expandedLoanId: ""

    signal openAddLoan()
    signal openRecordPayment(var loanData)

    actions: [
        Kirigami.Action {
            text: i18n("New Loan")
            icon.name: "list-add"
            onTriggered: page.openAddLoan()
        }
    ]

    ColumnLayout {
        width: parent.width
        spacing: Kirigami.Units.largeSpacing

        // KPI Summary
        Kirigami.CardsLayout {
            Layout.fillWidth: true
            maximumColumns: 3
            minimumColumnWidth: Kirigami.Units.gridUnit * 12

            Kirigami.AbstractCard {
                contentItem: ColumnLayout {
                    Controls.Label { text: i18n("MONEY LENT (ACTIVE)"); font.pixelSize: 10; font.bold: true; opacity: 0.6 }
                    Controls.Label { text: root.formatMoney(Loans.totalLentOutstanding); font.pixelSize: 20; font.bold: true; color: Kirigami.Theme.positiveTextColor }
                }
            }
            Kirigami.AbstractCard {
                contentItem: ColumnLayout {
                    Controls.Label { text: i18n("MONEY BORROWED (ACTIVE)"); font.pixelSize: 10; font.bold: true; opacity: 0.6 }
                    Controls.Label { text: root.formatMoney(Loans.totalBorrowedOutstanding); font.pixelSize: 20; font.bold: true; color: Kirigami.Theme.negativeTextColor }
                }
            }
            Kirigami.AbstractCard {
                contentItem: ColumnLayout {
                    Controls.Label { text: i18n("NET LOAN BALANCE"); font.pixelSize: 10; font.bold: true; opacity: 0.6 }
                    Controls.Label {
                        text: root.formatMoney(Loans.netBalance)
                        font.pixelSize: 20
                        font.bold: true
                        color: Loans.netBalance >= 0 ? Kirigami.Theme.positiveTextColor : Kirigami.Theme.negativeTextColor
                    }
                }
            }
        }

        // Search & Filter Tabs
        GridLayout {
            Layout.fillWidth: true
            columns: root.isWidescreen ? 2 : 1
            columnSpacing: Kirigami.Units.smallSpacing
            rowSpacing: Kirigami.Units.smallSpacing

            Kirigami.SearchField {
                Layout.fillWidth: true
                placeholderText: i18n("Search by friend, notes...")
                onTextChanged: page.searchQuery = text.toLowerCase().trim()
            }

            Flow {
                Layout.fillWidth: !root.isWidescreen
                spacing: Kirigami.Units.smallSpacing

                Repeater {
                    model: [
                        { id: "all", label: i18n("All") },
                        { id: "lent", label: i18n("Money Lent") },
                        { id: "borrowed", label: i18n("Money Borrowed") },
                        { id: "settled", label: i18n("Settled (%1)", Loans.settledCount) }
                    ]

                    delegate: Controls.Button {
                        required property var modelData
                        text: modelData.label
                        checkable: true
                        checked: page.activeFilter === modelData.id
                        onClicked: page.activeFilter = modelData.id
                    }
                }
            }
        }

        Kirigami.PlaceholderMessage {
            visible: Loans.count === 0
            Layout.fillWidth: true
            Layout.topMargin: Kirigami.Units.gridUnit * 3
            icon.name: "wallet-open"
            text: i18n("No loan records")
            explanation: i18n("Track money lent to friends or borrowed without cluttering your spending stats.")
            helpfulAction: Kirigami.Action {
                text: i18n("Record a Loan")
                icon.name: "list-add"
                onTriggered: page.openAddLoan()
            }
        }

        // Loan Cards
        Repeater {
            model: Loans

            delegate: Kirigami.AbstractCard {
                id: lCard
                required property string loanId
                required property string contactName
                required property string loanType
                required property double initialAmount
                required property double remainingAmount
                required property string account
                required property string startDate
                required property string dueDate
                required property string notes
                required property string status

                readonly property bool matchesTab: {
                    if (page.activeFilter === "lent") return loanType === "lent" && status === "active";
                    if (page.activeFilter === "borrowed") return loanType === "borrowed" && status === "active";
                    if (page.activeFilter === "settled") return status === "settled";
                    return true;
                }
                readonly property bool matchesSearch: page.searchQuery === ""
                    || contactName.toLowerCase().indexOf(page.searchQuery) !== -1
                    || notes.toLowerCase().indexOf(page.searchQuery) !== -1
                    || account.toLowerCase().indexOf(page.searchQuery) !== -1

                visible: matchesTab && matchesSearch
                Layout.fillWidth: true

                contentItem: ColumnLayout {
                    spacing: Kirigami.Units.smallSpacing

                    RowLayout {
                        Layout.fillWidth: true
                        spacing: Kirigami.Units.mediumSpacing

                        ColumnLayout {
                            Layout.fillWidth: true
                            spacing: 2
                            RowLayout {
                                spacing: Kirigami.Units.smallSpacing
                                Controls.Label {
                                    text: lCard.contactName
                                    font.bold: true
                                    font.pixelSize: 15
                                }
                                Controls.Label {
                                    text: lCard.loanType === "lent" ? i18n("LENT") : i18n("BORROWED")
                                    font.pixelSize: 10
                                    font.bold: true
                                    color: lCard.loanType === "lent" ? Kirigami.Theme.positiveTextColor : Kirigami.Theme.neutralTextColor
                                }
                                Controls.Label {
                                    text: lCard.status.toUpperCase()
                                    font.pixelSize: 10
                                    font.bold: true
                                    opacity: 0.7
                                }
                            }
                            Controls.Label {
                                text: i18n("Account: %1 · Started: %2%3", lCard.account, lCard.startDate, lCard.dueDate.length > 0 ? i18n(" · Due: %1", lCard.dueDate) : "")
                                font.pixelSize: 11
                                opacity: 0.7
                            }
                            Controls.Label {
                                visible: lCard.notes.length > 0
                                text: lCard.notes
                                font.pixelSize: 11
                                opacity: 0.75
                            }
                        }

                        ColumnLayout {
                            Layout.alignment: Qt.AlignRight
                            Controls.Label {
                                text: root.formatMoney(lCard.remainingAmount)
                                font.pixelSize: 16
                                font.bold: true
                                color: lCard.status === "settled" ? Kirigami.Theme.positiveTextColor : Kirigami.Theme.textColor
                            }
                            Controls.Label {
                                text: i18n("of %1", root.formatMoney(lCard.initialAmount))
                                font.pixelSize: 11
                                opacity: 0.65
                            }
                        }

                        Controls.Button {
                            visible: lCard.status === "active"
                            text: i18n("Record Payment")
                            icon.name: "list-add"
                            highlighted: true
                            onClicked: page.openRecordPayment({
                                id: lCard.loanId,
                                contactName: lCard.contactName,
                                type: lCard.loanType,
                                remainingAmount: lCard.remainingAmount,
                                account: lCard.account
                            })
                        }

                        Controls.ToolButton {
                            icon.name: page.expandedLoanId === lCard.loanId ? "arrow-up" : "arrow-down"
                            text: i18n("History")
                            onClicked: page.expandedLoanId = (page.expandedLoanId === lCard.loanId ? "" : lCard.loanId)
                        }

                        Controls.ToolButton {
                            icon.name: "edit-delete"
                            Controls.ToolTip.visible: hovered
                            Controls.ToolTip.text: i18n("Delete Loan Record")
                            onClicked: Loans.deleteLoan(lCard.loanId)
                        }
                    }

                    Controls.ProgressBar {
                        Layout.fillWidth: true
                        from: 0
                        to: lCard.initialAmount > 0 ? lCard.initialAmount : 1
                        value: lCard.initialAmount - lCard.remainingAmount
                    }

                    // Payment History
                    ColumnLayout {
                        visible: page.expandedLoanId === lCard.loanId
                        Layout.fillWidth: true
                        spacing: 4

                        Kirigami.Separator { Layout.fillWidth: true }

                        Controls.Label {
                            text: i18n("Payment History")
                            font.bold: true
                            font.pixelSize: 12
                        }

                        Controls.Label {
                            visible: Loans.paymentsForLoan(lCard.loanId).length === 0
                            text: i18n("No payments recorded yet.")
                            font.pixelSize: 11
                            opacity: 0.65
                        }

                        Repeater {
                            model: page.expandedLoanId === lCard.loanId ? Loans.paymentsForLoan(lCard.loanId) : []

                            delegate: RowLayout {
                                required property var modelData
                                Layout.fillWidth: true
                                Controls.Label { text: modelData.date; font.pixelSize: 11; opacity: 0.7; Layout.preferredWidth: 90 }
                                Controls.Label { text: modelData.account; font.pixelSize: 11; opacity: 0.75; Layout.fillWidth: true }
                                Controls.Label { text: modelData.notes; font.pixelSize: 11; opacity: 0.65; Layout.fillWidth: true }
                                Controls.Label { text: root.formatMoney(modelData.amount); font.bold: true; font.pixelSize: 12 }
                            }
                        }
                    }
                }
            }
        }
    }
}
