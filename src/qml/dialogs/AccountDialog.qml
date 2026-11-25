import QtQuick
import QtQuick.Controls as Controls
import QtQuick.Layouts
import org.kde.kirigami as Kirigami

Kirigami.Dialog {
    id: dialog

    property var editingAccount: null

    signal accountRenamed(string oldName, string newName)

    title: editingAccount ? i18n("Edit Account") : i18n("Add Account")
    standardButtons: Kirigami.Dialog.Ok | Kirigami.Dialog.Cancel
    preferredWidth: 420
    padding: Kirigami.Units.largeSpacing

    onOpened: {
        if (editingAccount) {
            accNameField.text = editingAccount.name || "";
            var idx = accTypeCombo.indexOfValue(editingAccount.accountType);
            accTypeCombo.currentIndex = idx >= 0 ? idx : 0;
            balanceField.text = Number(editingAccount.balance || 0).toFixed(2);
        } else {
            accNameField.text = "";
            accTypeCombo.currentIndex = 0;
            balanceField.text = "";
        }
        accNameField.forceActiveFocus();
    }

    onClosed: {
        editingAccount = null;
    }

    onAccepted: {
        var name = accNameField.text.trim();
        if (name.length === 0) return;
        var bal = parseFloat(balanceField.text) || 0.0;
        if (editingAccount) {
            var oldName = editingAccount.name;
            if (Accounts.updateAccount(editingAccount.accountId, name, accTypeCombo.currentValue, bal)) {
                if (oldName !== name) {
                    Transactions.refresh();
                    dialog.accountRenamed(oldName, name);
                }
            }
        } else {
            Accounts.addAccount(name, accTypeCombo.currentValue, bal);
        }
    }

    Kirigami.FormLayout {
        Controls.TextField {
            id: accNameField
            Kirigami.FormData.label: i18n("Account Name:")
            Layout.fillWidth: true
            placeholderText: {
                switch (accTypeCombo.currentValue) {
                case "investment": return i18n("e.g. Zerodha, Vanguard, Fidelity");
                case "credit": return i18n("e.g. Chase Sapphire, SBI Credit Card");
                case "loan": return i18n("e.g. Home Mortgage, Auto Loan");
                case "savings": return i18n("e.g. Emergency Fund, High Yield Savings");
                default: return i18n("e.g. HDFC Checking, ICICI Bank");
                }
            }
        }

        Controls.ComboBox {
            id: accTypeCombo
            Kirigami.FormData.label: i18n("Account Type:")
            Layout.fillWidth: true
            textRole: "label"
            valueRole: "id"
            model: [
                { id: "checking", label: i18n("Checking / Bank Account") },
                { id: "savings", label: i18n("Savings Account") },
                { id: "investment", label: i18n("Investment / Brokerage") },
                { id: "credit", label: i18n("Credit Card") },
                { id: "loan", label: i18n("Loan / Mortgage") }
            ]
        }

        Controls.TextField {
            id: balanceField
            Kirigami.FormData.label: dialog.editingAccount
                ? i18n("Balance (%1):", SettingsMgr.currencySymbol)
                : i18n("Starting Balance (%1):", SettingsMgr.currencySymbol)
            Layout.fillWidth: true
            placeholderText: "0.00"
            validator: DoubleValidator {}
        }
    }
}
