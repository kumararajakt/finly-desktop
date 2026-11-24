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

    // Mapping Config
    property string accountSource: "fixed"   // "fixed" | "column"
    property string categorySource: "auto"   // "auto" | "column"
    property string amountMode: "single"     // "single" | "double" | "type_column"

    // Preview State
    property var mappedRows: []
    property string previewSearch: ""
    property string previewFilter: "all"     // "all" | "expense" | "income"

    title: i18n("Import Transactions (CSV)")
    standardButtons: Kirigami.Dialog.NoButton
    preferredWidth: 820
    preferredHeight: 620
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
        notesColCombo.model = [""].concat(csvHeaders);
        accountColCombo.model = csvHeaders;
        fixedAccountCombo.model = Accounts.accountNames();
        categoryColCombo.model = csvHeaders;

        singleAmountColCombo.model = csvHeaders;
        debitColCombo.model = csvHeaders;
        creditColCombo.model = csvHeaders;
        typeModeAmountColCombo.model = csvHeaders;
        typeColCombo.model = csvHeaders;

        // Auto-detect columns & amount mode
        var hasDebit = -1;
        var hasCredit = -1;
        var hasTypeCol = -1;
        for (var i = 0; i < csvHeaders.length; ++i) {
            var h = csvHeaders[i].toLowerCase();
            if (h.indexOf("date") !== -1) dateColCombo.currentIndex = i;
            if (h.indexOf("payee") !== -1 || h.indexOf("desc") !== -1 || h.indexOf("merchant") !== -1 || h.indexOf("narration") !== -1) payeeColCombo.currentIndex = i;
            if (h.indexOf("note") !== -1 || h.indexOf("memo") !== -1 || h.indexOf("remark") !== -1) notesColCombo.currentIndex = i + 1;
            if (h.indexOf("account") !== -1) accountColCombo.currentIndex = i;
            if (h.indexOf("category") !== -1) categoryColCombo.currentIndex = i;
            if (h.indexOf("amount") !== -1 || h.indexOf("value") !== -1) {
                singleAmountColCombo.currentIndex = i;
                typeModeAmountColCombo.currentIndex = i;
            }
            if (h.indexOf("debit") !== -1 || h.indexOf("withdrawal") !== -1 || h === "dr") hasDebit = i;
            if (h.indexOf("credit") !== -1 || h.indexOf("deposit") !== -1 || h === "cr") hasCredit = i;
            if (h === "type" || h.indexOf("dr/cr") !== -1 || h.indexOf("cr/dr") !== -1) hasTypeCol = i;
        }

        if (hasDebit >= 0 && hasCredit >= 0) {
            amountMode = "double";
            debitColCombo.currentIndex = hasDebit;
            creditColCombo.currentIndex = hasCredit;
        } else if (hasTypeCol >= 0) {
            amountMode = "type_column";
            typeColCombo.currentIndex = hasTypeCol;
        } else {
            amountMode = "single";
        }
    }

    function parseNumber(val) {
        var s = String(val || "").replace(/[^0-9.\-]/g, "");
        return parseFloat(s) || 0.0;
    }

    function buildPreviewRows() {
        var out = [];
        var dCol = dateColCombo.currentText;
        var pCol = payeeColCombo.currentText;
        var nCol = notesColCombo.currentText;

        for (var i = 0; i < csvRows.length; ++i) {
            var r = csvRows[i];
            var amt = 0.0;

            if (amountMode === "single") {
                amt = parseNumber(r[singleAmountColCombo.currentText]);
                if (invertSignCheck.checked) amt = -amt;
            } else if (amountMode === "double") {
                var deb = Math.abs(parseNumber(r[debitColCombo.currentText]));
                var cred = Math.abs(parseNumber(r[creditColCombo.currentText]));
                amt = cred > 0 ? cred : (deb > 0 ? -deb : 0.0);
            } else if (amountMode === "type_column") {
                var rawA = Math.abs(parseNumber(r[typeModeAmountColCombo.currentText]));
                var tVal = String(r[typeColCombo.currentText] || "").toLowerCase().trim();
                var credList = creditIndField.text.toLowerCase().split(",");
                var debList = debitIndField.text.toLowerCase().split(",");
                var isCredit = credList.some(function(ind) { return ind.trim().length > 0 && tVal.indexOf(ind.trim()) !== -1; });
                var isDebit = debList.some(function(ind) { return ind.trim().length > 0 && tVal.indexOf(ind.trim()) !== -1; });
                amt = isCredit && !isDebit ? rawA : -rawA;
            }

            var payee = String(r[pCol] || "Imported").trim();
            var notes = nCol.length > 0 ? String(r[nCol] || "").trim() : "";
            var acc = accountSource === "column"
                ? String(r[accountColCombo.currentText] || "Checking").trim()
                : (fixedAccountCombo.currentText || "Checking");
            var cat = categorySource === "column"
                ? (String(r[categoryColCombo.currentText] || "").trim() || CsvSvc.guessCategory(payee, notes))
                : CsvSvc.guessCategory(payee, notes);

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

    function filteredPreviewRows() {
        var q = previewSearch.toLowerCase().trim();
        return mappedRows.filter(function(r) {
            if (previewFilter === "expense" && r.amount >= 0) return false;
            if (previewFilter === "income" && r.amount < 0) return false;
            if (q.length > 0) {
                return r.payee.toLowerCase().indexOf(q) !== -1
                    || r.category.toLowerCase().indexOf(q) !== -1
                    || r.account.toLowerCase().indexOf(q) !== -1;
            }
            return true;
        });
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

        // Header Stepper & File Picker
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
        Controls.ScrollView {
            visible: dialog.step === 0
            Layout.fillWidth: true
            Layout.fillHeight: true
            contentWidth: availableWidth
            clip: true

            ColumnLayout {
                width: parent.width
                spacing: Kirigami.Units.mediumSpacing

                Kirigami.PlaceholderMessage {
                    visible: dialog.csvRows.length === 0
                    Layout.fillWidth: true
                    Layout.topMargin: Kirigami.Units.gridUnit * 3
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
                    spacing: Kirigami.Units.mediumSpacing

                    RowLayout {
                        Controls.Label { text: i18n("Loaded %1 rows from %2", dialog.csvRows.length, dialog.fileName); font.bold: true }
                        Controls.ToolButton {
                            text: dialog.showSample ? i18n("Hide sample") : i18n("Show sample")
                            onClicked: dialog.showSample = !dialog.showSample
                        }
                    }

                    Kirigami.AbstractCard {
                        visible: dialog.showSample && dialog.csvHeaders.length > 0
                        Layout.fillWidth: true

                        contentItem: Controls.ScrollView {
                            Layout.fillWidth: true
                            implicitHeight: Math.min(180, sampleTableCol.implicitHeight + 8)
                            clip: true

                            ColumnLayout {
                                id: sampleTableCol
                                spacing: 0

                                RowLayout {
                                    spacing: Kirigami.Units.mediumSpacing
                                    Repeater {
                                        model: dialog.csvHeaders
                                        delegate: Controls.Label {
                                            required property string modelData
                                            Layout.preferredWidth: 130
                                            text: modelData
                                            font.bold: true
                                            font.pixelSize: 11
                                            elide: Text.ElideRight
                                        }
                                    }
                                }

                                Kirigami.Separator {
                                    Layout.fillWidth: true
                                    Layout.topMargin: 4
                                    Layout.bottomMargin: 4
                                }

                                Repeater {
                                    model: dialog.csvRows.slice(0, 4)
                                    delegate: ColumnLayout {
                                        id: sampleRowDelegate
                                        required property var modelData
                                        spacing: 0

                                        RowLayout {
                                            spacing: Kirigami.Units.mediumSpacing
                                            Repeater {
                                                model: dialog.csvHeaders
                                                delegate: Controls.Label {
                                                    required property string modelData
                                                    Layout.preferredWidth: 130
                                                    text: String(sampleRowDelegate.modelData[modelData] || "")
                                                    font.pixelSize: 11
                                                    opacity: 0.85
                                                    elide: Text.ElideRight
                                                }
                                            }
                                        }

                                        Kirigami.Separator {
                                            Layout.fillWidth: true
                                            Layout.topMargin: 3
                                            Layout.bottomMargin: 3
                                            opacity: 0.4
                                        }
                                    }
                                }
                            }
                        }
                    }

                    // Core Column Mapping
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
                        Controls.ComboBox { id: notesColCombo; Kirigami.FormData.label: i18n("Notes Column:") }

                        // Account Source Radios
                        RowLayout {
                            Kirigami.FormData.label: i18n("Account Source:")
                            Controls.RadioButton {
                                text: i18n("Specific Account")
                                checked: dialog.accountSource === "fixed"
                                onClicked: dialog.accountSource = "fixed"
                            }
                            Controls.RadioButton {
                                text: i18n("From CSV Column")
                                checked: dialog.accountSource === "column"
                                onClicked: dialog.accountSource = "column"
                            }
                        }
                        Controls.ComboBox {
                            id: fixedAccountCombo
                            visible: dialog.accountSource === "fixed"
                            Kirigami.FormData.label: i18n("Target Account:")
                        }
                        Controls.ComboBox {
                            id: accountColCombo
                            visible: dialog.accountSource === "column"
                            Kirigami.FormData.label: i18n("Account Column:")
                        }

                        // Category Source Radios
                        RowLayout {
                            Kirigami.FormData.label: i18n("Category Source:")
                            Controls.RadioButton {
                                text: i18n("Smart Auto")
                                checked: dialog.categorySource === "auto"
                                onClicked: dialog.categorySource = "auto"
                            }
                            Controls.RadioButton {
                                text: i18n("CSV Column")
                                checked: dialog.categorySource === "column"
                                onClicked: dialog.categorySource = "column"
                            }
                        }
                        Controls.ComboBox {
                            id: categoryColCombo
                            visible: dialog.categorySource === "column"
                            Kirigami.FormData.label: i18n("Category Column:")
                        }

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

                    // Amount Mapping Modes (matches Tauri 3-mode selector)
                    Kirigami.AbstractCard {
                        Layout.fillWidth: true
                        contentItem: ColumnLayout {
                            spacing: Kirigami.Units.smallSpacing

                            RowLayout {
                                Layout.fillWidth: true
                                Controls.Label { Layout.fillWidth: true; text: i18n("Amount Mapping"); font.bold: true }
                                Controls.Button {
                                    text: i18n("Single Column")
                                    checkable: true
                                    checked: dialog.amountMode === "single"
                                    onClicked: dialog.amountMode = "single"
                                }
                                Controls.Button {
                                    text: i18n("Debit / Credit")
                                    checkable: true
                                    checked: dialog.amountMode === "double"
                                    onClicked: dialog.amountMode = "double"
                                }
                                Controls.Button {
                                    text: i18n("Type Column")
                                    checkable: true
                                    checked: dialog.amountMode === "type_column"
                                    onClicked: dialog.amountMode = "type_column"
                                }
                            }

                            // Single Column Mode
                            Kirigami.FormLayout {
                                visible: dialog.amountMode === "single"
                                Layout.fillWidth: true
                                Controls.ComboBox { id: singleAmountColCombo; Kirigami.FormData.label: i18n("Amount Column:") }
                                Controls.CheckBox { id: invertSignCheck; text: i18n("Invert sign (positive values are expenses)") }
                            }

                            // Double Column (Debit / Credit) Mode
                            Kirigami.FormLayout {
                                visible: dialog.amountMode === "double"
                                Layout.fillWidth: true
                                Controls.ComboBox { id: debitColCombo; Kirigami.FormData.label: i18n("Debit / Withdrawal Column:") }
                                Controls.ComboBox { id: creditColCombo; Kirigami.FormData.label: i18n("Credit / Deposit Column:") }
                            }

                            // Type Column Mode
                            Kirigami.FormLayout {
                                visible: dialog.amountMode === "type_column"
                                Layout.fillWidth: true
                                Controls.ComboBox { id: typeModeAmountColCombo; Kirigami.FormData.label: i18n("Amount Column:") }
                                Controls.ComboBox { id: typeColCombo; Kirigami.FormData.label: i18n("Dr/Cr Type Column:") }
                                Controls.TextField {
                                    id: creditIndField
                                    Kirigami.FormData.label: i18n("Credit Indicators:")
                                    text: "credit,cr,deposit,income"
                                }
                                Controls.TextField {
                                    id: debitIndField
                                    Kirigami.FormData.label: i18n("Debit Indicators:")
                                    text: "debit,dr,withdrawal,expense"
                                }
                            }
                        }
                    }

                    RowLayout {
                        Layout.fillWidth: true
                        spacing: Kirigami.Units.smallSpacing
                        Item { Layout.fillWidth: true }
                        Controls.Button {
                            text: i18n("Cancel")
                            icon.name: "dialog-cancel"
                            onClicked: dialog.close()
                        }
                        Controls.Button {
                            text: i18n("Continue to Preview →")
                            highlighted: true
                            onClicked: dialog.buildPreviewRows()
                        }
                    }
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
                spacing: Kirigami.Units.smallSpacing

                Kirigami.SearchField {
                    Layout.fillWidth: true
                    placeholderText: i18n("Search preview records...")
                    onTextChanged: dialog.previewSearch = text
                }

                Controls.Button {
                    text: i18n("All")
                    checkable: true
                    checked: dialog.previewFilter === "all"
                    onClicked: dialog.previewFilter = "all"
                }
                Controls.Button {
                    text: i18n("Expense")
                    checkable: true
                    checked: dialog.previewFilter === "expense"
                    onClicked: dialog.previewFilter = "expense"
                }
                Controls.Button {
                    text: i18n("Income")
                    checkable: true
                    checked: dialog.previewFilter === "income"
                    onClicked: dialog.previewFilter = "income"
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
                    model: dialog.filteredPreviewRows()
                    delegate: RowLayout {
                        required property var modelData
                        width: ListView.view.width
                        spacing: Kirigami.Units.smallSpacing

                        Controls.CheckBox {
                            checked: modelData.selected
                            onToggled: {
                                var copy = dialog.mappedRows.slice();
                                for (var i = 0; i < copy.length; ++i) {
                                    if (copy[i].id === modelData.id) {
                                        copy[i].selected = checked;
                                        break;
                                    }
                                }
                                dialog.mappedRows = copy;
                            }
                        }
                        Controls.Label { text: modelData.date; Layout.preferredWidth: 85; font.pixelSize: 11 }
                        Controls.Label { text: modelData.payee; Layout.fillWidth: true; elide: Text.ElideRight }
                        Controls.Label { text: modelData.account; Layout.preferredWidth: 100; font.pixelSize: 11; opacity: 0.75; elide: Text.ElideRight }
                        Controls.ComboBox {
                            Layout.preferredWidth: 130
                            model: Categories.categoryNames()
                            currentIndex: Math.max(0, Categories.categoryNames().indexOf(modelData.category))
                            onActivated: {
                                var copy = dialog.mappedRows.slice();
                                for (var i = 0; i < copy.length; ++i) {
                                    if (copy[i].id === modelData.id) {
                                        copy[i].category = currentText;
                                        copy[i].categoryColor = Categories.colorForCategory(currentText);
                                        break;
                                    }
                                }
                                dialog.mappedRows = copy;
                            }
                        }
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
                    text: i18n("Cancel")
                    icon.name: "dialog-cancel"
                    onClicked: dialog.close()
                }
                Controls.Button {
                    text: i18n("Import %1 Transactions", dialog.mappedRows.filter(function(r) { return r.selected; }).length)
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
