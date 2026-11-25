import QtQuick
import QtQuick.Controls as Controls
import QtQuick.Layouts
import org.kde.kirigami as Kirigami

Kirigami.Dialog {
    id: dialog

    property var editingTransaction: null
    property string activeTab: "expense" // "expense" | "income" | "transfer" | "loan"
    property string loanDirection: "lent" // "lent" | "received"

    readonly property bool isEditing: editingTransaction !== null

    title: isEditing ? i18n("Edit Transaction") : i18n("New Transaction")
    standardButtons: Kirigami.Dialog.Ok | Kirigami.Dialog.Cancel
    preferredWidth: 520
    padding: Kirigami.Units.largeSpacing

    onOpened: {
        var accNames = Accounts.accountNames();
        accountCombo.model = accNames;
        toAccountCombo.model = accNames;
        categoryCombo.model = Categories.categoryNames();
        magicField.text = "";

        if (isEditing) {
            activeTab = editingTransaction.type || "expense";
            loanDirection = editingTransaction.amount < 0 ? "lent" : "received";
            amountField.text = String(Math.abs(editingTransaction.amount));
            payeeField.text = editingTransaction.payee || "";
            dateField.text = editingTransaction.date || Qt.formatDate(new Date(), "yyyy-MM-dd");
            notesArea.text = editingTransaction.notes || "";
            pendingCheck.checked = (editingTransaction.status === "pending");

            var accIdx = accNames.indexOf(editingTransaction.account);
            if (accIdx >= 0) accountCombo.currentIndex = accIdx;
            var toIdx = accNames.indexOf(editingTransaction.toAccount);
            if (toIdx >= 0) toAccountCombo.currentIndex = toIdx;
            var catIdx = Categories.categoryNames().indexOf(editingTransaction.category);
            if (catIdx >= 0) categoryCombo.currentIndex = catIdx;
        } else {
            activeTab = "expense";
            loanDirection = "lent";
            amountField.text = "";
            payeeField.text = "";
            dateField.text = Qt.formatDate(new Date(), "yyyy-MM-dd");
            notesArea.text = "";
            pendingCheck.checked = false;
            accountCombo.currentIndex = 0;
            toAccountCombo.currentIndex = accNames.length > 1 ? 1 : 0;
            categoryCombo.currentIndex = 0;
        }
        amountField.forceActiveFocus();
    }

    onAccepted: {
        var amt = parseFloat(amountField.text) || 0.0;
        if (amt <= 0) return;

        var accName = accountCombo.currentText || "Checking";
        var catName = categoryCombo.currentText || "Other";
        var txType = activeTab;
        var finalAmt = amt;
        var payeeText = payeeField.text.trim();

        if (activeTab === "expense") {
            finalAmt = -Math.abs(amt);
            if (payeeText.length === 0) payeeText = catName;
        } else if (activeTab === "income") {
            finalAmt = Math.abs(amt);
            if (payeeText.length === 0) payeeText = catName;
        } else if (activeTab === "transfer") {
            finalAmt = -Math.abs(amt);
            catName = "Transfer";
            if (payeeText.length === 0) payeeText = i18n("Transfer to %1", toAccountCombo.currentText);
        } else if (activeTab === "loan") {
            if (payeeText.length === 0) return;
            var lType = loanDirection === "lent" ? "lent" : "borrowed";
            if (isEditing) {
                Loans.addLoanFromTransaction(
                    editingTransaction.id,
                    payeeText,
                    lType,
                    amt,
                    accName,
                    dateField.text.trim(),
                    notesArea.text.trim()
                );
            } else {
                Loans.addLoan(
                    payeeText,
                    lType,
                    amt,
                    accName,
                    dateField.text.trim(),
                    "",
                    notesArea.text.trim()
                );
            }
            return;
        }

        var payload = {
            id: isEditing ? editingTransaction.id : "",
            date: dateField.text.trim(),
            payee: payeeText,
            category: catName,
            categoryColor: Categories.colorForCategory(catName),
            account: accName,
            toAccount: activeTab === "transfer" ? toAccountCombo.currentText : "",
            amount: finalAmt,
            type: txType,
            status: pendingCheck.checked ? "pending" : "cleared",
            notes: notesArea.text.trim()
        };

        if (isEditing) {
            Transactions.updateTransaction(payload);
        } else {
            Transactions.addTransaction(payload);
        }
    }

    ColumnLayout {
        spacing: Kirigami.Units.mediumSpacing

        // AI Magic Input (visible when AI enabled & creating)
        RowLayout {
            visible: SettingsMgr.aiEnabled && !dialog.isEditing
            Layout.fillWidth: true
            spacing: Kirigami.Units.smallSpacing

            Controls.TextField {
                id: magicField
                Layout.fillWidth: true
                placeholderText: i18n("AI Magic Input: e.g. \"Dinner with Alex for $42\"")
            }
            Controls.Button {
                text: AiSvc.busy ? i18n("Parsing...") : i18n("Parse")
                icon.name: "quickopen"
                enabled: !AiSvc.busy && magicField.text.trim().length > 0
                onClicked: AiSvc.parseNaturalLanguageTransaction(magicField.text)
            }
        }

        Connections {
            target: AiSvc
            function onTransactionParsed(txData, error) {
                if (!dialog.opened) return;
                if (error && error.length > 0) {
                    root.showPassiveNotification(i18n("Parse error: %1", error));
                    return;
                }
                if (txData.type) dialog.activeTab = txData.type;
                if (txData.amount !== undefined) amountField.text = String(Math.abs(txData.amount));
                if (txData.payee) payeeField.text = txData.payee;
                if (txData.date) dateField.text = txData.date;
                if (txData.notes) notesArea.text = txData.notes;
                if (txData.category) {
                    var cIdx = Categories.categoryNames().indexOf(txData.category);
                    if (cIdx >= 0) categoryCombo.currentIndex = cIdx;
                }
                if (txData.account) {
                    var aIdx = Accounts.accountNames().indexOf(txData.account);
                    if (aIdx >= 0) accountCombo.currentIndex = aIdx;
                }
            }
        }

        // Type Tabs
        RowLayout {
            Layout.fillWidth: true
            spacing: Kirigami.Units.smallSpacing

            Repeater {
                model: [
                    { id: "expense", label: i18n("Expense") },
                    { id: "income", label: i18n("Income") },
                    { id: "transfer", label: i18n("Transfer") },
                    { id: "loan", label: i18n("Loan") }
                ]
                delegate: Controls.Button {
                    required property var modelData
                    Layout.fillWidth: true
                    text: modelData.label
                    checkable: true
                    checked: dialog.activeTab === modelData.id
                    onClicked: dialog.activeTab = modelData.id
                }
            }
        }

        // Loan Direction Toggle
        RowLayout {
            visible: dialog.activeTab === "loan"
            Layout.fillWidth: true
            spacing: Kirigami.Units.smallSpacing

            Controls.Button {
                Layout.fillWidth: true
                text: i18n("Money Lent")
                checkable: true
                checked: dialog.loanDirection === "lent"
                onClicked: dialog.loanDirection = "lent"
            }
            Controls.Button {
                Layout.fillWidth: true
                text: i18n("Payment / Borrowed")
                checkable: true
                checked: dialog.loanDirection === "received"
                onClicked: dialog.loanDirection = "received"
            }
        }

        Kirigami.FormLayout {
            Layout.fillWidth: true

            Controls.TextField {
                id: amountField
                Kirigami.FormData.label: i18n("Amount (%1):", SettingsMgr.currencySymbol)
                Layout.fillWidth: true
                placeholderText: "0.00"
                validator: DoubleValidator { bottom: 0.01 }
            }

            Controls.TextField {
                id: payeeField
                Kirigami.FormData.label: dialog.activeTab === "loan" ? i18n("Contact:") : i18n("Payee:")
                Layout.fillWidth: true
                placeholderText: dialog.activeTab === "loan"
                    ? i18n("e.g. Alex, Sarah")
                    : (dialog.activeTab === "transfer" ? i18n("e.g. Card bill payment") : i18n("e.g. Trader Joe's, Employer"))
            }

            Controls.ComboBox {
                id: accountCombo
                Kirigami.FormData.label: dialog.activeTab === "transfer" ? i18n("From Account:") : i18n("Account:")
                Layout.fillWidth: true
            }

            Controls.ComboBox {
                id: toAccountCombo
                visible: dialog.activeTab === "transfer"
                Kirigami.FormData.label: i18n("To Account:")
                Layout.fillWidth: true
            }

            Controls.ComboBox {
                id: categoryCombo
                visible: dialog.activeTab !== "transfer" && dialog.activeTab !== "loan"
                Kirigami.FormData.label: i18n("Category:")
                Layout.fillWidth: true
            }

            Controls.TextField {
                id: dateField
                Kirigami.FormData.label: i18n("Date:")
                Layout.fillWidth: true
                placeholderText: "YYYY-MM-DD"
            }

            Controls.TextArea {
                id: notesArea
                Kirigami.FormData.label: i18n("Notes:")
                Layout.fillWidth: true
                Layout.preferredHeight: 72
                placeholderText: i18n("Add extra context, transaction reference...")
                wrapMode: TextEdit.Wrap
            }

            Controls.CheckBox {
                id: pendingCheck
                visible: dialog.activeTab !== "loan"
                text: i18n("Mark as pending")
            }
        }
    }
}
