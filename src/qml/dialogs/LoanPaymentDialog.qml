import QtQuick
import QtQuick.Controls as Controls
import QtQuick.Layouts
import org.kde.kirigami as Kirigami

Kirigami.Dialog {
    id: dialog

    property var targetLoan: null

    title: i18n("Record Loan Payment")
    standardButtons: Kirigami.Dialog.Ok | Kirigami.Dialog.Cancel
    preferredWidth: 440
    padding: Kirigami.Units.largeSpacing

    onOpened: {
        var accNames = Accounts.accountNames();
        accountCombo.model = accNames;
        if (targetLoan) {
            var idx = accNames.indexOf(targetLoan.account);
            accountCombo.currentIndex = idx >= 0 ? idx : 0;
            amountField.text = String(targetLoan.remainingAmount);
        } else {
            amountField.text = "";
        }
        dateField.text = Qt.formatDate(new Date(), "yyyy-MM-dd");
        notesField.text = "";
        amountField.forceActiveFocus();
    }

    onAccepted: {
        if (!targetLoan) return;
        var amt = parseFloat(amountField.text) || 0.0;
        if (amt <= 0) return;
        Loans.recordPayment(
            targetLoan.id,
            amt,
            accountCombo.currentText,
            dateField.text.trim(),
            notesField.text.trim()
        );
    }

    ColumnLayout {
        spacing: Kirigami.Units.mediumSpacing

        Kirigami.AbstractCard {
            visible: dialog.targetLoan !== null
            Layout.fillWidth: true
            contentItem: RowLayout {
                Controls.Label {
                    Layout.fillWidth: true
                    text: dialog.targetLoan
                        ? i18n("%1 · Remaining: %2", dialog.targetLoan.contactName, root.formatMoney(dialog.targetLoan.remainingAmount))
                        : ""
                    font.bold: true
                }
                Controls.ToolButton {
                    text: i18n("Full")
                    onClicked: if (dialog.targetLoan) amountField.text = String(dialog.targetLoan.remainingAmount)
                }
                Controls.ToolButton {
                    text: i18n("50%")
                    onClicked: if (dialog.targetLoan) amountField.text = (dialog.targetLoan.remainingAmount / 2.0).toFixed(2)
                }
            }
        }

        Kirigami.FormLayout {
            Layout.fillWidth: true
            wideMode: root.isWidescreen

            Controls.TextField {
                id: amountField
                Kirigami.FormData.label: i18n("Payment Amount (%1):", SettingsMgr.currencySymbol)
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
                id: dateField
                Kirigami.FormData.label: i18n("Date:")
                Layout.fillWidth: true
                placeholderText: "YYYY-MM-DD"
            }

            Controls.TextField {
                id: notesField
                Kirigami.FormData.label: i18n("Notes:")
                Layout.fillWidth: true
                placeholderText: i18n("e.g. Bank transfer, cash returned")
            }
        }
    }
}
