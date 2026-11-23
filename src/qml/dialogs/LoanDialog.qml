import QtQuick
import QtQuick.Controls as Controls
import QtQuick.Layouts
import org.kde.kirigami as Kirigami

Kirigami.Dialog {
    id: dialog

    property string loanType: "lent" // "lent" | "borrowed"

    title: i18n("New Loan Record")
    standardButtons: Kirigami.Dialog.Ok | Kirigami.Dialog.Cancel
    preferredWidth: 460
    padding: Kirigami.Units.largeSpacing

    onOpened: {
        loanType = "lent";
        contactField.text = "";
        amountField.text = "";
        accountCombo.model = Accounts.accountNames();
        accountCombo.currentIndex = 0;
        startDateField.text = Qt.formatDate(new Date(), "yyyy-MM-dd");
        dueDateField.text = "";
        notesField.text = "";
        contactField.forceActiveFocus();
    }

    onAccepted: {
        var contact = contactField.text.trim();
        var amt = parseFloat(amountField.text) || 0.0;
        if (contact.length === 0 || amt <= 0) return;
        Loans.addLoan(
            contact,
            loanType,
            amt,
            accountCombo.currentText,
            startDateField.text.trim(),
            dueDateField.text.trim(),
            notesField.text.trim()
        );
    }

    ColumnLayout {
        spacing: Kirigami.Units.mediumSpacing

        RowLayout {
            Layout.fillWidth: true
            spacing: Kirigami.Units.smallSpacing

            Controls.Button {
                Layout.fillWidth: true
                text: i18n("I Lent Money")
                checkable: true
                checked: dialog.loanType === "lent"
                onClicked: dialog.loanType = "lent"
            }
            Controls.Button {
                Layout.fillWidth: true
                text: i18n("I Borrowed Money")
                checkable: true
                checked: dialog.loanType === "borrowed"
                onClicked: dialog.loanType = "borrowed"
            }
        }

        Kirigami.FormLayout {
            Layout.fillWidth: true

            Controls.TextField {
                id: contactField
                Kirigami.FormData.label: i18n("Contact Name:")
                Layout.fillWidth: true
                placeholderText: i18n("e.g. Alex, Bob, Sarah")
            }

            Controls.TextField {
                id: amountField
                Kirigami.FormData.label: i18n("Amount (%1):", SettingsMgr.currencySymbol)
                Layout.fillWidth: true
                placeholderText: "0.00"
                validator: DoubleValidator { bottom: 0.01 }
            }

            Controls.ComboBox {
                id: accountCombo
                Kirigami.FormData.label: i18n("Account:")
                Layout.fillWidth: true
            }

            Controls.TextField {
                id: startDateField
                Kirigami.FormData.label: i18n("Start Date:")
                Layout.fillWidth: true
                placeholderText: "YYYY-MM-DD"
            }

            Controls.TextField {
                id: dueDateField
                Kirigami.FormData.label: i18n("Due Date (Optional):")
                Layout.fillWidth: true
                placeholderText: "YYYY-MM-DD"
            }

            Controls.TextField {
                id: notesField
                Kirigami.FormData.label: i18n("Notes:")
                Layout.fillWidth: true
                placeholderText: i18n("e.g. Concert tickets, trip split")
            }
        }
    }
}
