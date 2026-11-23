import QtQuick
import QtQuick.Controls as Controls
import QtQuick.Layouts
import org.kde.kirigami as Kirigami

Kirigami.Dialog {
    id: dialog

    property var targetCategory: null

    readonly property int affectedCount: targetCategory ? (targetCategory.txCount || 0) : 0

    title: i18n("Delete Category")
    standardButtons: Kirigami.Dialog.Ok | Kirigami.Dialog.Cancel
    preferredWidth: 420
    padding: Kirigami.Units.largeSpacing

    onOpened: {
        if (targetCategory) {
            var others = Categories.categoryNames().filter(function(n) {
                return n !== targetCategory.name;
            });
            reassignCombo.model = others;
            var defIdx = others.indexOf("Other");
            reassignCombo.currentIndex = defIdx >= 0 ? defIdx : 0;
        }
    }

    onAccepted: {
        if (!targetCategory) return;
        if (affectedCount > 0) {
            Categories.deleteCategory(targetCategory.id, reassignCombo.currentText);
        } else {
            Categories.deleteCategory(targetCategory.id, "");
        }
    }

    ColumnLayout {
        spacing: Kirigami.Units.mediumSpacing

        Kirigami.InlineMessage {
            visible: dialog.affectedCount > 0
            Layout.fillWidth: true
            type: Kirigami.MessageType.Warning
            text: i18n("%1 transaction(s) are currently assigned to \"%2\". Select a category to move them to before deleting.",
                       dialog.affectedCount,
                       dialog.targetCategory ? dialog.targetCategory.name : "")
        }

        Controls.Label {
            visible: dialog.affectedCount === 0
            Layout.fillWidth: true
            wrapMode: Text.WordWrap
            text: i18n("Are you sure you want to delete \"%1\"? There are no transactions assigned to it.",
                       dialog.targetCategory ? dialog.targetCategory.name : "")
        }

        Kirigami.FormLayout {
            visible: dialog.affectedCount > 0
            Layout.fillWidth: true

            Controls.ComboBox {
                id: reassignCombo
                Kirigami.FormData.label: i18n("Move transactions to:")
                Layout.fillWidth: true
            }
        }
    }
}
