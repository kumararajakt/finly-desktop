import QtQuick
import QtQuick.Controls as Controls
import QtQuick.Layouts
import org.kde.kirigami as Kirigami

Kirigami.Dialog {
    id: dialog

    property int step: 0 // 0 = Review & Map, 1 = Preview
    property string fileName: ""
    property var csvHeaders: []
    property var csvRows: []
    property string sampleText: ""
    property bool showSample: false
    property var mappedRows: []

    title: i18n("Import Transactions (CSV)")
    standardButtons: Kirigami.Dialog.Cancel
    preferredWidth: 760
    preferredHeight: 560
    padding: Kirigami.Units.largeSpacing

    function pickAndLoadCsv() {
        var path = CsvSvc.pickCsvFile();
        if (!path || path.length === 0) return;
        var res = CsvSvc.parseCsvFile(path);
        if (!res.ok) {
            root.showPassiveNotification(i18n("CSV Error: %1", res.error));
            return;
        }
        fileName = res.fileName;
        csvHeaders = res.headers;
        csvRows = res.rows;
        sampleText = res.sampleText;
        step = 0;

        dateColCombo.model = csvHeaders;
        payeeColCombo.model = csvHeaders;
        amountColCombo.model = csvHeaders;
        notesColCombo.model = [""].concat(csvHeaders);
        fixedAccountCombo.model = Accounts.accountNames();

        // Auto-guess columns
        for (var i = 0; i < csvHeaders.length; ++i) {
            var h = csvHeaders[i].toLowerCase();
            if (h.indexOf("date") !== -1) dateColCombo.currentIndex = i;
            if (h.indexOf("payee") !== -1 || h.indexOf("desc") !== -1 || h.indexOf("merchant") !== -1 || h.indexOf("narration") !== -1) payeeColCombo.currentIndex = i;
            if (h.indexOf("amount") !== -1 || h.indexOf("value") !== -1) amountColCombo.currentIndex = i;
        }
    }

    function buildPreviewRows() {
        var out = [];
        var dCol = dateColCombo.currentText;
        var pCol = payeeColCombo.currentText;
        var aCol = amountColCombo.currentText;
        var nCol = notesColCombo.currentText;
        var acc = fixedAccountCombo.currentText || "Checking";

        for (var i = 0; i < csvRows.length; ++i) {
            var r = csvRows[i];
            var rawAmt = String(r[aCol] || "0").replace(/[^0-9.\-]/g, "");
            var amt = parseFloat(rawAmt) || 0.0;
            if (invertSignCheck.checked) amt = -amt;
            var payee = String(r[pCol] || "Imported").trim();
            var notes = nCol.length > 0 ? String(r[nCol] || "").trim() : "";
            var cat = CsvSvc.guessCategory(payee, notes);
            out.push({
                id: "imp-" + i,
                selected: amt !== 0,
                date: CsvSvc.normalizeDate(String(r[dCol] || ""), dateFormatCombo.currentValue),
                payee: payee,
                category: cat,
                categoryColor: Categories.colorForCategory(cat),
                account: acc,
                toAccount: "",
                amount: amt,
                type: amt >= 0 ? "income" : "expense",
                status: statusCombo.currentValue,
                notes: notes
            });
        }
        mappedRows = out;
        step = 1;
    }

    Connections {
        target: AiSvc
        function onBatchCategorized(categoryById, error) {
            if (error && error.length > 0) {
                root.showPassiveNotification(i18n("AI Categorize Error: %1", error));
                return;
            }
            var copy = dialog.mappedRows.slice();
            for (var i = 0; i < copy.length; ++i) {
                var cat = categoryById[copy[i].id];
                if (cat && cat.length > 0) {
                    copy[i].category = cat;
                    copy[i].categoryColor = Categories.colorForCategory(cat);
                }
            }
            dialog.mappedRows = copy;
            root.showPassiveNotification(i18n("AI categorization complete"));
        }
    }

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
                text: i18n("2. Preview (%1)", dialog.mappedRows.length)
                checkable: true
                enabled: dialog.csvRows.length > 0
                checked: dialog.step === 1
                onClicked: dialog.buildPreviewRows()
            }
            Item { Layout.fillWidth: true }
            Controls.Button {
                text: dialog.fileName.length > 0 ? dialog.fileName : i18n("Choose CSV File...")
                icon.name: "document-open"
                onClicked: dialog.pickAndLoadCsv()
            }
        }

        // Step 1: Review & Map
        ColumnLayout {
            visible: dialog.step === 0
            Layout.fillWidth: true
            Layout.fillHeight: true
            spacing: Kirigami.Units.mediumSpacing

            Kirigami.PlaceholderMessage {
                visible: dialog.csvRows.length === 0
                Layout.fillWidth: true
                Layout.fillHeight: true
                icon.name: "document-import"
                text: i18n("Select a CSV bank statement")
                helpfulAction: Kirigami.Action {
                    text: i18n("Choose CSV File...")
                    icon.name: "document-open"
                    onTriggered: dialog.pickAndLoadCsv()
                }
            }

            ColumnLayout {
                visible: dialog.csvRows.length > 0
                Layout.fillWidth: true
                spacing: Kirigami.Units.smallSpacing

                RowLayout {
                    Controls.Label { text: i18n("Loaded %1 rows from %2", dialog.csvRows.length, dialog.fileName); font.bold: true }
                    Controls.ToolButton {
                        text: dialog.showSample ? i18n("Hide sample") : i18n("Show sample")
                        onClicked: dialog.showSample = !dialog.showSample
                    }
                }

                Controls.TextArea {
                    visible: dialog.showSample
                    Layout.fillWidth: true
                    Layout.preferredHeight: 80
                    readOnly: true
                    text: dialog.sampleText
                }

                Kirigami.FormLayout {
                    Layout.fillWidth: true
                    Controls.ComboBox { id: dateColCombo; Kirigami.FormData.label: i18n("Date Column:") }
                    Controls.ComboBox {
                        id: dateFormatCombo
                        Kirigami.FormData.label: i18n("Date Format:")
                        textRole: "label"
                        valueRole: "id"
                        model: [
                            { id: "auto", label: i18n("Auto-detect") },
                            { id: "YYYY-MM-DD", label: "YYYY-MM-DD" },
                            { id: "DD/MM/YYYY", label: "DD/MM/YYYY" },
                            { id: "MM/DD/YYYY", label: "MM/DD/YYYY" }
                        ]
                    }
                    Controls.ComboBox { id: payeeColCombo; Kirigami.FormData.label: i18n("Payee Column:") }
                    Controls.ComboBox { id: amountColCombo; Kirigami.FormData.label: i18n("Amount Column:") }
                    Controls.CheckBox { id: invertSignCheck; text: i18n("Invert amount sign (positive = expense)") }
                    Controls.ComboBox { id: notesColCombo; Kirigami.FormData.label: i18n("Notes Column:") }
                    Controls.ComboBox { id: fixedAccountCombo; Kirigami.FormData.label: i18n("Target Account:") }
                    Controls.ComboBox {
                        id: statusCombo
                        Kirigami.FormData.label: i18n("Default Status:")
                        textRole: "label"
                        valueRole: "id"
                        model: [
                            { id: "cleared", label: i18n("Cleared") },
                            { id: "pending", label: i18n("Pending") },
                            { id: "reconciled", label: i18n("Reconciled") }
                        ]
                    }
                }

                Controls.Button {
                    Layout.alignment: Qt.AlignRight
                    text: i18n("Continue to Preview →")
                    highlighted: true
                    onClicked: dialog.buildPreviewRows()
                }
            }
        }

        // Step 2: Preview
        ColumnLayout {
            visible: dialog.step === 1
            Layout.fillWidth: true
            Layout.fillHeight: true
            spacing: Kirigami.Units.smallSpacing

            RowLayout {
                Layout.fillWidth: true
                Controls.Label {
                    Layout.fillWidth: true
                    text: i18n("Review %1 parsed transactions", dialog.mappedRows.length)
                    font.bold: true
                }
                Controls.Button {
                    visible: SettingsMgr.aiEnabled
                    text: i18n("AI Smart Categorize")
                    icon.name: "quickopen"
                    enabled: !AiSvc.busy && dialog.mappedRows.length > 0
                    onClicked: {
                        var batch = dialog.mappedRows.map(function(r) {
                            return { id: r.id, payee: r.payee, notes: r.notes };
                        });
                        AiSvc.smartCategorizeBatch(batch);
                    }
                }
            }

            Controls.ScrollView {
                Layout.fillWidth: true
                Layout.fillHeight: true
                clip: true

                ListView {
                    model: dialog.mappedRows
                    delegate: RowLayout {
                        required property int index
                        required property var modelData
                        width: ListView.view.width
                        spacing: Kirigami.Units.smallSpacing

                        Controls.CheckBox {
                            checked: modelData.selected
                            onToggled: {
                                var copy = dialog.mappedRows.slice();
                                copy[index].selected = checked;
                                dialog.mappedRows = copy;
                            }
                        }
                        Controls.Label { text: modelData.date; Layout.preferredWidth: 85; font.pixelSize: 11 }
                        Controls.Label { text: modelData.payee; Layout.fillWidth: true; elide: Text.ElideRight }
                        Controls.Label { text: modelData.category; Layout.preferredWidth: 110; font.pixelSize: 11 }
                        Controls.Label {
                            text: root.formatMoney(modelData.amount)
                            Layout.preferredWidth: 90
                            font.bold: true
                            color: modelData.amount >= 0 ? Kirigami.Theme.positiveTextColor : Kirigami.Theme.negativeTextColor
                        }
                    }
                }
            }

            RowLayout {
                Layout.fillWidth: true
                Controls.Button {
                    text: i18n("← Back to Mapping")
                    onClicked: dialog.step = 0
                }
                Item { Layout.fillWidth: true }
                Controls.Button {
                    text: i18n("Import Selected")
                    icon.name: "dialog-ok-apply"
                    highlighted: true
                    onClicked: {
                        var toImport = dialog.mappedRows.filter(function(r) { return r.selected; });
                        var count = Transactions.importTransactions(toImport);
                        root.showPassiveNotification(i18n("Imported %1 transactions", count));
                        dialog.close();
                    }
                }
            }
        }
    }
}
