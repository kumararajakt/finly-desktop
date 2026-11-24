import QtQuick
import QtQuick.Controls as Controls
import QtQuick.Layouts
import org.kde.kirigami as Kirigami

Kirigami.Dialog {
    id: dialog

    property string frequency: "day"      // "day" | "week" | "month" | "year"
    property int interval: 1
    property var weekDays: [1]
    property string monthMode: "day"      // "day" | "weekday"
    property int monthDay: 23
    property string monthWeekOrdinal: "first"
    property int monthWeekDay: 1
    property string timeStr: "12:00"
    property string startsStr: Qt.formatDate(new Date(), "yyyy-MM-dd")
    property string endsMode: "never"     // "never" | "on" | "after"
    property string endsDateStr: Qt.formatDate(new Date(), "yyyy-MM-dd")
    property int endsCount: 1

    signal scheduleSaved(var scheduleConfig)

    title: i18n("Repeat Reminder")
    standardButtons: Kirigami.Dialog.NoButton
    preferredWidth: 440
    padding: Kirigami.Units.largeSpacing

    function loadFromConfig(cfg) {
        frequency = cfg.frequency || "day";
        interval = cfg.interval || 1;
        weekDays = cfg.weekDays ? cfg.weekDays.slice() : [1];
        monthMode = cfg.monthMode || "day";
        monthDay = cfg.monthDay || new Date().getDate();
        monthWeekOrdinal = cfg.monthWeekOrdinal || "first";
        monthWeekDay = cfg.monthWeekDay !== undefined ? cfg.monthWeekDay : 1;
        timeStr = cfg.time || "12:00";
        startsStr = cfg.starts || Qt.formatDate(new Date(), "yyyy-MM-dd");
        endsMode = cfg.endsMode || "never";
        endsDateStr = cfg.endsDate || Qt.formatDate(new Date(), "yyyy-MM-dd");
        endsCount = cfg.endsCount || 1;
    }

    function hasWeekDay(dayIdx) {
        return weekDays.indexOf(dayIdx) !== -1;
    }

    function toggleWeekDay(dayIdx) {
        var copy = weekDays.slice();
        var pos = copy.indexOf(dayIdx);
        if (pos === -1) {
            copy.push(dayIdx);
        } else if (copy.length > 1) {
            copy.splice(pos, 1);
        }
        copy.sort(function(a, b) { return a - b; });
        weekDays = copy;
    }

    ColumnLayout {
        spacing: Kirigami.Units.mediumSpacing

        // Top 4-Tab Bar: Day | Week | Month | Year
        RowLayout {
            Layout.fillWidth: true
            spacing: 4

            Repeater {
                model: [
                    { id: "day", label: i18n("Day") },
                    { id: "week", label: i18n("Week") },
                    { id: "month", label: i18n("Month") },
                    { id: "year", label: i18n("Year") }
                ]
                delegate: Controls.Button {
                    required property var modelData
                    Layout.fillWidth: true
                    text: modelData.label
                    checkable: true
                    checked: dialog.frequency === modelData.id
                    onClicked: dialog.frequency = modelData.id
                }
            }
        }

        // Week Tab: On Sun..Sat
        ColumnLayout {
            visible: dialog.frequency === "week"
            Layout.fillWidth: true
            spacing: Kirigami.Units.smallSpacing

            Controls.Label { text: i18n("On"); font.bold: true }
            RowLayout {
                Layout.fillWidth: true
                spacing: 4
                Repeater {
                    model: [
                        { id: 0, label: i18n("Sun") },
                        { id: 1, label: i18n("Mon") },
                        { id: 2, label: i18n("Tue") },
                        { id: 3, label: i18n("Wed") },
                        { id: 4, label: i18n("Thu") },
                        { id: 5, label: i18n("Fri") },
                        { id: 6, label: i18n("Sat") }
                    ]
                    delegate: Controls.Button {
                        required property var modelData
                        Layout.fillWidth: true
                        text: modelData.label
                        checkable: true
                        checked: dialog.hasWeekDay(modelData.id)
                        onClicked: dialog.toggleWeekDay(modelData.id)
                    }
                }
            }
        }

        // Month Tab: On day [1..31] vs On the [first..last] [Monday..Sunday]
        ColumnLayout {
            visible: dialog.frequency === "month"
            Layout.fillWidth: true
            spacing: Kirigami.Units.smallSpacing

            RowLayout {
                Layout.fillWidth: true
                Controls.RadioButton {
                    text: i18n("On day")
                    checked: dialog.monthMode === "day"
                    onClicked: dialog.monthMode = "day"
                }
                Controls.ComboBox {
                    enabled: dialog.monthMode === "day"
                    model: {
                        var arr = [];
                        for (var d = 1; d <= 31; ++d) arr.push(d);
                        return arr;
                    }
                    currentIndex: Math.max(0, dialog.monthDay - 1)
                    onActivated: dialog.monthDay = currentIndex + 1
                }
            }

            RowLayout {
                Layout.fillWidth: true
                Controls.RadioButton {
                    text: i18n("On the")
                    checked: dialog.monthMode === "weekday"
                    onClicked: dialog.monthMode = "weekday"
                }
                Controls.ComboBox {
                    enabled: dialog.monthMode === "weekday"
                    textRole: "label"
                    valueRole: "id"
                    model: [
                        { id: "first", label: i18n("first") },
                        { id: "second", label: i18n("second") },
                        { id: "third", label: i18n("third") },
                        { id: "fourth", label: i18n("fourth") },
                        { id: "last", label: i18n("last") }
                    ]
                    currentIndex: Math.max(0, ["first", "second", "third", "fourth", "last"].indexOf(dialog.monthWeekOrdinal))
                    onActivated: dialog.monthWeekOrdinal = currentValue
                }
                Controls.ComboBox {
                    enabled: dialog.monthMode === "weekday"
                    textRole: "label"
                    valueRole: "id"
                    model: [
                        { id: 1, label: i18n("Monday") },
                        { id: 2, label: i18n("Tuesday") },
                        { id: 3, label: i18n("Wednesday") },
                        { id: 4, label: i18n("Thursday") },
                        { id: 5, label: i18n("Friday") },
                        { id: 6, label: i18n("Saturday") },
                        { id: 0, label: i18n("Sunday") }
                    ]
                    currentIndex: {
                        var order = [1, 2, 3, 4, 5, 6, 0];
                        return Math.max(0, order.indexOf(dialog.monthWeekDay));
                    }
                    onActivated: dialog.monthWeekDay = currentValue
                }
            }
        }

        // Every N day/week/month/year
        RowLayout {
            Layout.fillWidth: true
            spacing: Kirigami.Units.smallSpacing

            Controls.Label { text: i18n("Every"); Layout.preferredWidth: 55 }
            Controls.SpinBox {
                from: 1
                to: 365
                value: dialog.interval
                onValueModified: dialog.interval = value
            }
            Controls.Label {
                text: {
                    switch (dialog.frequency) {
                    case "week": return i18n("week");
                    case "month": return i18n("month");
                    case "year": return i18n("year");
                    default: return i18n("day");
                    }
                }
            }
        }

        Kirigami.Separator { Layout.fillWidth: true }

        // At & Starts
        Kirigami.FormLayout {
            Layout.fillWidth: true

            Controls.TextField {
                Kirigami.FormData.label: i18n("At")
                text: dialog.timeStr
                placeholderText: "12:00"
                onTextChanged: dialog.timeStr = text
            }

            Controls.TextField {
                Kirigami.FormData.label: i18n("Starts")
                text: dialog.startsStr
                placeholderText: "YYYY-MM-DD"
                onTextChanged: dialog.startsStr = text
            }
        }

        // Ends
        ColumnLayout {
            Layout.fillWidth: true
            spacing: Kirigami.Units.smallSpacing

            Controls.Label { text: i18n("Ends"); font.bold: true }

            Controls.RadioButton {
                text: i18n("Never")
                checked: dialog.endsMode === "never"
                onClicked: dialog.endsMode = "never"
            }

            RowLayout {
                Controls.RadioButton {
                    text: i18n("On")
                    checked: dialog.endsMode === "on"
                    onClicked: dialog.endsMode = "on"
                }
                Controls.TextField {
                    enabled: dialog.endsMode === "on"
                    text: dialog.endsDateStr
                    placeholderText: "YYYY-MM-DD"
                    onTextChanged: dialog.endsDateStr = text
                }
            }

            RowLayout {
                Controls.RadioButton {
                    text: i18n("After")
                    checked: dialog.endsMode === "after"
                    onClicked: dialog.endsMode = "after"
                }
                Controls.SpinBox {
                    enabled: dialog.endsMode === "after"
                    from: 1
                    to: 999
                    value: dialog.endsCount
                    onValueModified: dialog.endsCount = value
                }
                Controls.Label {
                    enabled: dialog.endsMode === "after"
                    text: i18n("occurrence")
                }
            }
        }

        // Footer Cancel / Save
        RowLayout {
            Layout.fillWidth: true
            Item { Layout.fillWidth: true }
            Controls.Button {
                text: i18n("Cancel")
                onClicked: dialog.close()
            }
            Controls.Button {
                text: i18n("Save")
                highlighted: true
                onClicked: {
                    dialog.scheduleSaved({
                        frequency: dialog.frequency,
                        interval: dialog.interval,
                        weekDays: dialog.weekDays,
                        monthMode: dialog.monthMode,
                        monthDay: dialog.monthDay,
                        monthWeekOrdinal: dialog.monthWeekOrdinal,
                        monthWeekDay: dialog.monthWeekDay,
                        time: dialog.timeStr.trim(),
                        starts: dialog.startsStr.trim(),
                        endsMode: dialog.endsMode,
                        endsDate: dialog.endsDateStr.trim(),
                        endsCount: dialog.endsCount,
                        resetOccurrences: true
                    });
                    dialog.close();
                }
            }
        }
    }
}
