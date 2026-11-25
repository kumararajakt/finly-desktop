import QtQuick
import QtQuick.Controls as Controls
import QtQuick.Layouts
import org.kde.kirigami as Kirigami

Kirigami.Dialog {
    id: dialog

    property var editingBudget: null
    property string selectedColor: "#5842e3"

    readonly property bool isEditing: editingBudget !== null
    readonly property var colorSwatches: ["#5842e3", "#2563eb", "#10b981", "#f59e0b", "#ef4444", "#ec4899", "#8b5cf6", "#06b6d4"]

    title: isEditing ? i18n("Edit Budget") : i18n("Create Budget")
    standardButtons: Kirigami.Dialog.Ok | Kirigami.Dialog.Cancel
    preferredWidth: 420
    padding: Kirigami.Units.largeSpacing

    onOpened: {
        var cats = Categories.categoryNames();
        cats.push("__custom__");
        catCombo.model = cats;
        if (isEditing) {
            var idx = cats.indexOf(editingBudget.category);
            if (idx >= 0) {
                catCombo.currentIndex = idx;
                customCatField.text = "";
            } else {
                catCombo.currentIndex = cats.length - 1;
                customCatField.text = editingBudget.category;
            }
            limitField.text = String(editingBudget.limit);
            selectedColor = editingBudget.color || "#5842e3";
        } else {
            catCombo.currentIndex = 0;
            customCatField.text = "";
            limitField.text = "";
            selectedColor = "#5842e3";
        }
    }

    onAccepted: {
        var catName = catCombo.currentText === "__custom__" ? customCatField.text.trim() : catCombo.currentText;
        var lim = parseFloat(limitField.text) || 0.0;
        if (catName.length === 0 || lim <= 0) return;

        if (isEditing) {
            Budgets.updateBudget(editingBudget.id, catName, lim, selectedColor, "monthly");
        } else {
            Budgets.addBudget(catName, lim, selectedColor, "monthly");
        }
    }

    Kirigami.FormLayout {
        wideMode: root.isWidescreen
        Controls.ComboBox {
            id: catCombo
            Kirigami.FormData.label: i18n("Category:")
            Layout.fillWidth: true
            displayText: currentText === "__custom__" ? i18n("+ Custom Category...") : currentText
        }

        Controls.TextField {
            id: customCatField
            visible: catCombo.currentText === "__custom__"
            Kirigami.FormData.label: i18n("Custom Name:")
            Layout.fillWidth: true
            placeholderText: i18n("Type custom category name...")
        }

        Controls.TextField {
            id: limitField
            Kirigami.FormData.label: i18n("Monthly Limit (%1):", SettingsMgr.currencySymbol)
            Layout.fillWidth: true
            placeholderText: i18n("e.g. 500")
            validator: DoubleValidator { bottom: 1 }
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
                    radius: 12
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
    }
}
