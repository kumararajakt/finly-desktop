import QtQuick
import QtQuick.Controls as Controls
import QtQuick.Layouts
import org.kde.kirigami as Kirigami

Kirigami.Dialog {
    id: dialog

    property int activeTab: 0 // 0 = General, 1 = AI Assistant, 2 = Reminders
    property string selectedTheme: SettingsMgr.theme
    property string selectedProvider: "ollama"
    property bool showApiKey: false
    property var pendingReminderSchedule: ({})

    title: i18n("Settings")
    standardButtons: Kirigami.Dialog.Ok | Kirigami.Dialog.Cancel
    preferredWidth: 560
    padding: Kirigami.Units.largeSpacing

    onOpened: {
        selectedTheme = SettingsMgr.theme;
        nameField.text = SettingsMgr.userName;
        var countries = SettingsMgr.countries;
        var cIdx = 0;
        for (var i = 0; i < countries.length; ++i) {
            if (countries[i].country === SettingsMgr.country) {
                cIdx = i;
                break;
            }
        }
        countryCombo.currentIndex = cIdx;

        var cfg = SettingsMgr.aiConfig;
        aiEnabledSwitch.checked = cfg.enabled || false;
        selectedProvider = cfg.provider || "ollama";
        ollamaEndpointField.text = cfg.ollamaEndpoint || "http://localhost:11434";
        ollamaModelField.text = cfg.ollamaModel || "llama3.2";
        geminiKeyField.text = cfg.geminiApiKey || "";
        geminiModelField.text = cfg.geminiModel || "gemini-1.5-flash";
        openaiKeyField.text = cfg.openaiApiKey || "";
        openaiModelField.text = cfg.openaiModel || "gpt-4o-mini";
        anthropicKeyField.text = cfg.anthropicApiKey || "";
        anthropicModelField.text = cfg.anthropicModel || "claude-3-5-haiku-20241022";

        var rem = ReminderSvc.config;
        reminderEnabledSwitch.checked = rem.enabled || false;
        reminderTitleField.text = rem.title || i18n("Finly Reminder");
        reminderMessageField.text = rem.message || i18n("Time to log today's expenses and review your budgets!");
        pendingReminderSchedule = rem;
        traySwitch.checked = SettingsMgr.minimizeToTray;
    }

    onAccepted: {
        SettingsMgr.theme = selectedTheme;
        SettingsMgr.minimizeToTray = traySwitch.checked;
        var curr = SettingsMgr.currencyForCountry(countryCombo.currentValue);
        SettingsMgr.saveProfile(nameField.text.trim(), countryCombo.currentValue, curr.currencyCode, curr.symbol);
        SettingsMgr.saveAIConfig({
            enabled: aiEnabledSwitch.checked,
            provider: selectedProvider,
            ollamaEndpoint: ollamaEndpointField.text.trim(),
            ollamaModel: ollamaModelField.text.trim(),
            geminiApiKey: geminiKeyField.text.trim(),
            geminiModel: geminiModelField.text.trim(),
            openaiApiKey: openaiKeyField.text.trim(),
            openaiModel: openaiModelField.text.trim(),
            anthropicApiKey: anthropicKeyField.text.trim(),
            anthropicModel: anthropicModelField.text.trim()
        });
        var remPayload = Object.assign({}, pendingReminderSchedule, {
            enabled: reminderEnabledSwitch.checked,
            title: reminderTitleField.text.trim(),
            message: reminderMessageField.text.trim()
        });
        ReminderSvc.saveConfig(remPayload);
    }

    ColumnLayout {
        spacing: Kirigami.Units.mediumSpacing

        RowLayout {
            Layout.fillWidth: true
            spacing: Kirigami.Units.smallSpacing

            Controls.Button {
                Layout.fillWidth: true
                text: i18n("General")
                icon.name: "configure"
                checkable: true
                checked: dialog.activeTab === 0
                onClicked: dialog.activeTab = 0
            }
            Controls.Button {
                Layout.fillWidth: true
                text: i18n("AI Assistant")
                icon.name: "quickopen"
                checkable: true
                checked: dialog.activeTab === 1
                onClicked: dialog.activeTab = 1
            }
            Controls.Button {
                Layout.fillWidth: true
                text: i18n("Reminders")
                icon.name: "notifications"
                checkable: true
                checked: dialog.activeTab === 2
                onClicked: dialog.activeTab = 2
            }
        }

        // General Tab
        Kirigami.FormLayout {
            visible: dialog.activeTab === 0
            Layout.fillWidth: true

            RowLayout {
                Kirigami.FormData.label: i18n("Theme:")
                spacing: Kirigami.Units.smallSpacing
                Repeater {
                    model: [
                        { id: "light", label: i18n("Light") },
                        { id: "dark", label: i18n("Dark") },
                        { id: "auto", label: i18n("Auto") }
                    ]
                    delegate: Controls.Button {
                        required property var modelData
                        text: modelData.label
                        checkable: true
                        checked: dialog.selectedTheme === modelData.id
                        onClicked: dialog.selectedTheme = modelData.id
                    }
                }
            }

            Controls.TextField {
                id: nameField
                Kirigami.FormData.label: i18n("Your Name:")
                Layout.fillWidth: true
                placeholderText: i18n("Enter your name...")
            }

            Controls.ComboBox {
                id: countryCombo
                Kirigami.FormData.label: i18n("Country & Currency:")
                Layout.fillWidth: true
                model: SettingsMgr.countries
                textRole: "country"
                valueRole: "country"
            }

            Controls.Switch {
                id: traySwitch
                Kirigami.FormData.label: i18n("System Tray:")
                text: i18n("Minimize to system tray when closing window")
            }
        }

        // AI Assistant Tab
        ColumnLayout {
            visible: dialog.activeTab === 1
            Layout.fillWidth: true
            spacing: Kirigami.Units.mediumSpacing

            Controls.Switch {
                id: aiEnabledSwitch
                text: i18n("Enable AI Features (Ask Finly, Digest, Smart Parse)")
            }

            RowLayout {
                Layout.fillWidth: true
                spacing: Kirigami.Units.smallSpacing
                Repeater {
                    model: [
                        { id: "ollama", label: i18n("Local Ollama") },
                        { id: "gemini", label: i18n("Google Gemini") },
                        { id: "openai", label: i18n("OpenAI") },
                        { id: "anthropic", label: i18n("Anthropic") }
                    ]
                    delegate: Controls.Button {
                        required property var modelData
                        Layout.fillWidth: true
                        text: modelData.label
                        checkable: true
                        checked: dialog.selectedProvider === modelData.id
                        onClicked: dialog.selectedProvider = modelData.id
                    }
                }
            }

            Kirigami.FormLayout {
                Layout.fillWidth: true

                Controls.TextField {
                    id: ollamaEndpointField
                    visible: dialog.selectedProvider === "ollama"
                    Kirigami.FormData.label: i18n("Ollama Endpoint:")
                    Layout.fillWidth: true
                }
                Controls.TextField {
                    id: ollamaModelField
                    visible: dialog.selectedProvider === "ollama"
                    Kirigami.FormData.label: i18n("Ollama Model:")
                    Layout.fillWidth: true
                }

                Controls.TextField {
                    id: geminiKeyField
                    visible: dialog.selectedProvider === "gemini"
                    Kirigami.FormData.label: i18n("Gemini API Key:")
                    echoMode: dialog.showApiKey ? TextInput.Normal : TextInput.Password
                    Layout.fillWidth: true
                }
                Controls.TextField {
                    id: geminiModelField
                    visible: dialog.selectedProvider === "gemini"
                    Kirigami.FormData.label: i18n("Gemini Model:")
                    Layout.fillWidth: true
                }

                Controls.TextField {
                    id: openaiKeyField
                    visible: dialog.selectedProvider === "openai"
                    Kirigami.FormData.label: i18n("OpenAI API Key:")
                    echoMode: dialog.showApiKey ? TextInput.Normal : TextInput.Password
                    Layout.fillWidth: true
                }
                Controls.TextField {
                    id: openaiModelField
                    visible: dialog.selectedProvider === "openai"
                    Kirigami.FormData.label: i18n("OpenAI Model:")
                    Layout.fillWidth: true
                }

                Controls.TextField {
                    id: anthropicKeyField
                    visible: dialog.selectedProvider === "anthropic"
                    Kirigami.FormData.label: i18n("Anthropic API Key:")
                    echoMode: dialog.showApiKey ? TextInput.Normal : TextInput.Password
                    Layout.fillWidth: true
                }
                Controls.TextField {
                    id: anthropicModelField
                    visible: dialog.selectedProvider === "anthropic"
                    Kirigami.FormData.label: i18n("Anthropic Model:")
                    Layout.fillWidth: true
                }
            }

            RowLayout {
                Layout.fillWidth: true
                Controls.CheckBox {
                    visible: dialog.selectedProvider !== "ollama"
                    text: i18n("Show API Key")
                    checked: dialog.showApiKey
                    onToggled: dialog.showApiKey = checked
                }
                Controls.Button {
                    visible: dialog.selectedProvider === "ollama"
                    text: i18n("Detect Models")
                    icon.name: "view-refresh"
                    onClicked: AiSvc.detectOllamaModels(ollamaEndpointField.text)
                }
                Item { Layout.fillWidth: true }
                Controls.Button {
                    text: i18n("Test Connection")
                    icon.name: "network-connect"
                    onClicked: AiSvc.testConnection({
                        provider: dialog.selectedProvider,
                        ollamaEndpoint: ollamaEndpointField.text.trim(),
                        ollamaModel: ollamaModelField.text.trim(),
                        geminiApiKey: geminiKeyField.text.trim(),
                        geminiModel: geminiModelField.text.trim(),
                        openaiApiKey: openaiKeyField.text.trim(),
                        openaiModel: openaiModelField.text.trim(),
                        anthropicApiKey: anthropicKeyField.text.trim(),
                        anthropicModel: anthropicModelField.text.trim()
                    })
                }
            }

            Connections {
                target: AiSvc
                function onTestConnectionFinished(success, message, models) {
                    if (dialog.opened) root.showPassiveNotification(message);
                }
                function onOllamaModelsDetected(models, error) {
                    if (!dialog.opened) return;
                    if (error && error.length > 0) {
                        root.showPassiveNotification(i18n("Ollama error: %1", error));
                    } else if (models.length > 0) {
                        ollamaModelField.text = models[0];
                        root.showPassiveNotification(i18n("Found Ollama models: %1", models.join(", ")));
                    } else {
                        root.showPassiveNotification(i18n("Connected to Ollama, but no models installed."));
                    }
                }
            }
        }

        // Reminders Tab
        ColumnLayout {
            visible: dialog.activeTab === 2
            Layout.fillWidth: true
            spacing: Kirigami.Units.mediumSpacing

            Controls.Switch {
                id: reminderEnabledSwitch
                text: i18n("Enable Native Desktop Reminder Notifications")
            }

            Kirigami.FormLayout {
                Layout.fillWidth: true

                Controls.TextField {
                    id: reminderTitleField
                    Kirigami.FormData.label: i18n("Notification Title:")
                    Layout.fillWidth: true
                    placeholderText: i18n("Finly Reminder")
                }

                Controls.TextField {
                    id: reminderMessageField
                    Kirigami.FormData.label: i18n("Message:")
                    Layout.fillWidth: true
                    placeholderText: i18n("Time to log today's expenses and review your budgets!")
                }
            }

            Kirigami.AbstractCard {
                Layout.fillWidth: true
                contentItem: RowLayout {
                    spacing: Kirigami.Units.smallSpacing
                    ColumnLayout {
                        Layout.fillWidth: true
                        spacing: 2
                        Controls.Label {
                            text: i18n("Repeat Schedule")
                            font.bold: true
                        }
                        Controls.Label {
                            Layout.fillWidth: true
                            text: ReminderSvc.scheduleSummary
                            font.pixelSize: 11
                            opacity: 0.75
                            wrapMode: Text.WordWrap
                        }
                    }
                    Controls.Button {
                        text: i18n("Configure...")
                        icon.name: "view-calendar"
                        onClicked: {
                            reminderScheduleDialog.loadFromConfig(dialog.pendingReminderSchedule);
                            reminderScheduleDialog.open();
                        }
                    }
                }
            }

            RowLayout {
                Layout.fillWidth: true
                Item { Layout.fillWidth: true }
                Controls.Button {
                    text: i18n("Test Native Notification")
                    icon.name: "notifications"
                    onClicked: {
                        NotifySvc.notify(
                            reminderTitleField.text.trim() || i18n("Finly Reminder"),
                            reminderMessageField.text.trim() || i18n("Time to log today's expenses and review your budgets!")
                        );
                    }
                }
            }
        }
    }

    ReminderScheduleDialog {
        id: reminderScheduleDialog
        onScheduleSaved: (sched) => {
            var merged = Object.assign({}, dialog.pendingReminderSchedule, sched, {
                enabled: reminderEnabledSwitch.checked,
                title: reminderTitleField.text.trim(),
                message: reminderMessageField.text.trim()
            });
            dialog.pendingReminderSchedule = merged;
            ReminderSvc.saveConfig(merged);
        }
    }
}
