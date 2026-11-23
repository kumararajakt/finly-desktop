import QtQuick
import QtQuick.Controls as Controls
import QtQuick.Layouts
import org.kde.kirigami as Kirigami

Kirigami.Dialog {
    id: dialog

    property var editingCategory: null
    property string catType: "expense"
    property string selectedColor: "#5842e3"

    readonly property bool isEditing: editingCategory !== null
    readonly property var colorSwatches: ["#2563eb", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4", "#64748b"]

    title: isEditing ? i18n("Edit Category") : i18n("New Category")
    standardButtons: Kirigami.Dialog.Ok | Kirigami.Dialog.Cancel
    preferredWidth: 440
    padding: Kirigami.Units.largeSpacing

    onOpened: {
        if (isEditing) {
            nameField.text = editingCategory.name;
            catType = editingCategory.type || "expense";
            selectedColor = editingCategory.color || "#5842e3";
            descField.text = editingCategory.description || "";
        } else {
            nameField.text = "";
            catType = "expense";
            selectedColor = "#5842e3";
            descField.text = "";
        }
        nameField.forceActiveFocus();
    }

    onAccepted: {
        var n = nameField.text.trim();
        if (n.length === 0) return;
        if (isEditing) {
            Categories.updateCategory(editingCategory.id, n, catType, selectedColor, descField.text);
        } else {
            Categories.addCategory(n, catType, selectedColor, descField.text);
        }
    }

    Kirigami.FormLayout {
        Controls.TextField {
            id: nameField
            Kirigami.FormData.label: i18n("Name:")
            Layout.fillWidth: true
            placeholderText: i18n("e.g. Groceries, Gym, Freelance")
        }

        RowLayout {
            Kirigami.FormData.label: i18n("Type:")
            spacing: Kirigami.Units.smallSpacing
            Repeater {
                model: [
                    { id: "expense", label: i18n("Expense") },
                    { id: "income", label: i18n("Income") },
                    { id: "both", label: i18n("Both") }
                ]
                delegate: Controls.Button {
                    required property var modelData
                    text: modelData.label
                    checkable: true
                    checked: dialog.catType === modelData.id
                    onClicked: dialog.catType = modelData.id
                }
            }
        }

        RowLayout {
            Kirigami.FormData.label: i18n("Color:")
            spacing: 8
            Repeater {
                model: dialog.colorSwatches
                delegate: Rectangle {
                    required property string modelData
                    width: 24
                    height: 24
                    radius: 6
                    color: modelData
                    border.width: dialog.selectedColor === modelData ? 2 : 0
                    border.color: Kirigami.Theme.textColor
                    MouseArea {
                        anchors.fill: parent
                        cursorShape: Qt.PointingHandCursor
                        onClicked: dialog.selectedColor = modelData
                    }
                }
            }
        }

        Controls.TextField {
            id: descField
            Kirigami.FormData.label: i18n("Description:")
            Layout.fillWidth: true
            placeholderText: i18n("e.g. Daily coffee, office lunches")
        }
    }
}
