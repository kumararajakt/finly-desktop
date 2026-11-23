import QtQuick
import QtQuick.Controls as Controls
import QtQuick.Layouts
import org.kde.kirigami as Kirigami

Kirigami.Dialog {
    id: dialog

    property int step: 0 // 0 = Review & Map, 1 = Preview

    title: i18n("Import Transactions (CSV)")
    standardButtons: Kirigami.Dialog.Cancel
    preferredWidth: 720
    preferredHeight: 520
    padding: Kirigami.Units.largeSpacing

    ColumnLayout {
        spacing: Kirigami.Units.mediumSpacing

        RowLayout {
            Layout.fillWidth: true
            spacing: Kirigami.Units.smallSpacing

            Controls.Button {
                text: i18n("1. Review & Map")
                checkable: true
                checked: dialog.step === 0
                onClicked: dialog.step = 0
            }
            Controls.Button {
                text: i18n("2. Preview")
                checkable: true
                checked: dialog.step === 1
                onClicked: dialog.step = 1
            }
            Item { Layout.fillWidth: true }
            Controls.Button {
                text: i18n("Choose CSV File...")
                icon.name: "document-open"
                onClicked: root.showPassiveNotification(i18n("C++ CSV parser & QFileDialog wired in Phase 6"))
            }
        }

        Kirigami.PlaceholderMessage {
            Layout.fillWidth: true
            Layout.fillHeight: true
            icon.name: "document-import"
            text: dialog.step === 0 ? i18n("CSV Column Mapping") : i18n("Transaction Import Preview")
            explanation: i18n("Full RFC-4180 CSV parser, column mapper, and AI Smart Categorizer will be connected in Phase 6.")
        }
    }
}
