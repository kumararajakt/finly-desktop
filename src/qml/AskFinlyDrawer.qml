import QtQuick
import QtQuick.Controls as Controls
import QtQuick.Layouts
import org.kde.kirigami as Kirigami

Kirigami.OverlayDrawer {
    id: drawer

    edge: Qt.RightEdge
    modal: true
    drawerOpen: false
    visible: SettingsMgr.aiEnabled && drawerOpen
    width: Math.min(440, root.width * 0.85)
    padding: 0

    property var messages: []
    property var attachedTransactions: []
    property string initialPrompt: ""

    signal openAiSettings()

    onOpened: {
        if (initialPrompt.length > 0) {
            var p = initialPrompt;
            initialPrompt = "";
            sendMessage(p);
        }
        chatInput.forceActiveFocus();
    }

    function sendMessage(text) {
        var trimmed = text.trim();
        if (trimmed.length === 0 || AiSvc.busy) return;

        var copy = drawer.messages.slice();
        var history = copy.map(function(m) { return { role: m.role, content: m.content }; });
        copy.push({ role: "user", content: trimmed });
        drawer.messages = copy;
        chatInput.text = "";

        AiSvc.sendChatMessage(trimmed, history, drawer.attachedTransactions);
    }

    Connections {
        target: SettingsMgr
        function onAiConfigChanged() {
            if (!SettingsMgr.aiEnabled) {
                drawer.close();
            }
        }
    }

    Connections {
        target: AiSvc
        function onChatResponseReceived(reply, error) {
            var copy = drawer.messages.slice();
            if (error && error.length > 0) {
                copy.push({ role: "assistant", content: i18n("Error: %1", error) });
            } else {
                copy.push({ role: "assistant", content: reply });
            }
            drawer.messages = copy;
        }
    }

    contentItem: ColumnLayout {
        spacing: 0

        // Header
        RowLayout {
            Layout.fillWidth: true
            Layout.margins: Kirigami.Units.largeSpacing
            spacing: Kirigami.Units.smallSpacing

            Kirigami.Icon {
                source: "quickopen"
                Layout.preferredWidth: Kirigami.Units.iconSizes.smallMedium
                Layout.preferredHeight: Kirigami.Units.iconSizes.smallMedium
            }

            ColumnLayout {
                Layout.fillWidth: true
                spacing: 0
                Controls.Label { text: i18n("Ask Finly AI"); font.bold: true; font.pixelSize: 14 }
                Controls.Label { text: i18n("Provider: %1", SettingsMgr.aiProvider); font.pixelSize: 11; opacity: 0.65 }
            }

            Controls.ToolButton {
                icon.name: "edit-clear"
                Controls.ToolTip.visible: hovered
                Controls.ToolTip.text: i18n("Clear conversation")
                onClicked: drawer.messages = []
            }
            Controls.ToolButton {
                icon.name: "configure"
                Controls.ToolTip.visible: hovered
                Controls.ToolTip.text: i18n("AI Assistant Settings")
                onClicked: drawer.openAiSettings()
            }
            Controls.ToolButton {
                icon.name: "window-close"
                Controls.ToolTip.visible: hovered
                Controls.ToolTip.text: i18n("Close drawer")
                onClicked: drawer.close()
            }
        }

        Kirigami.Separator { Layout.fillWidth: true }

        // Chat Body
        Controls.ScrollView {
            Layout.fillWidth: true
            Layout.fillHeight: true
            contentWidth: availableWidth
            clip: true

            ColumnLayout {
                width: parent.width
                spacing: Kirigami.Units.mediumSpacing

                // Empty State with Starter Prompts
                ColumnLayout {
                    visible: drawer.messages.length === 0
                    Layout.fillWidth: true
                    Layout.margins: Kirigami.Units.largeSpacing
                    spacing: Kirigami.Units.smallSpacing

                    Controls.Label {
                        Layout.fillWidth: true
                        text: i18n("Ask anything about your spending, budgets, net worth, or loans.")
                        wrapMode: Text.WordWrap
                        opacity: 0.75
                    }

                    Repeater {
                        model: [
                            i18n("What is my top spending category and how can I cut back?"),
                            i18n("Am I on track with my budgets this month?"),
                            i18n("Summarize my current net worth and cash flow.")
                        ]
                        delegate: Controls.Button {
                            required property string modelData
                            Layout.fillWidth: true
                            text: modelData
                            onClicked: drawer.sendMessage(modelData)
                        }
                    }
                }

                // Message Bubbles
                Repeater {
                    model: drawer.messages
                    delegate: Kirigami.AbstractCard {
                        required property var modelData
                        Layout.fillWidth: true
                        Layout.leftMargin: modelData.role === "user" ? Kirigami.Units.gridUnit * 2 : Kirigami.Units.largeSpacing
                        Layout.rightMargin: modelData.role === "assistant" ? Kirigami.Units.gridUnit * 2 : Kirigami.Units.largeSpacing

                        contentItem: ColumnLayout {
                            spacing: 4
                            RowLayout {
                                Layout.fillWidth: true
                                Controls.Label {
                                    Layout.fillWidth: true
                                    text: modelData.role === "user" ? i18n("You") : i18n("Finly AI")
                                    font.pixelSize: 10
                                    font.bold: true
                                    opacity: 0.65
                                }
                            }
                            Controls.Label {
                                Layout.fillWidth: true
                                text: modelData.content
                                wrapMode: Text.WordWrap
                                textFormat: Text.PlainText
                            }
                        }
                    }
                }

                Controls.BusyIndicator {
                    visible: AiSvc.busy
                    running: AiSvc.busy
                    Layout.alignment: Qt.AlignHCenter
                }
            }
        }

        // Attached Transactions Bar
        Kirigami.InlineMessage {
            visible: drawer.attachedTransactions.length > 0
            Layout.fillWidth: true
            Layout.margins: Kirigami.Units.smallSpacing
            type: Kirigami.MessageType.Information
            text: i18n("%1 transaction(s) attached as context", drawer.attachedTransactions.length)
            actions: [
                Kirigami.Action {
                    text: i18n("Clear")
                    onTriggered: drawer.attachedTransactions = []
                }
            ]
        }

        Kirigami.Separator { Layout.fillWidth: true }

        // Input Bar
        RowLayout {
            Layout.fillWidth: true
            Layout.margins: Kirigami.Units.largeSpacing
            spacing: Kirigami.Units.smallSpacing

            Controls.TextField {
                id: chatInput
                Layout.fillWidth: true
                placeholderText: drawer.attachedTransactions.length > 0
                    ? i18n("Ask about selected transactions...")
                    : i18n("Ask Finly about your finances...")
                onAccepted: drawer.sendMessage(text)
            }

            Controls.Button {
                icon.name: "document-send"
                text: i18n("Send")
                highlighted: true
                enabled: !AiSvc.busy && chatInput.text.trim().length > 0
                onClicked: drawer.sendMessage(chatInput.text)
            }
        }
    }
}
