import QtQuick
import QtQuick.Controls as Controls
import QtQuick.Layouts
import org.kde.kirigami as Kirigami

Kirigami.Dialog {
    id: dialog

    title: i18n("Welcome to Finly")
    standardButtons: Kirigami.Dialog.NoButton
    closePolicy: Controls.Popup.NoAutoClose
    modal: true
    preferredWidth: 400
    maximumWidth: 420
    padding: Kirigami.Units.largeSpacing

    property string selectedCountry: "India"
    property var detectedCurrency: SettingsMgr.currencyForCountry(selectedCountry)

    onOpened: {
        nameField.text = "";
        selectedCountry = "India";
        countryCombo.currentIndex = 0;
        nameField.forceActiveFocus();
    }

    ColumnLayout {
        spacing: Kirigami.Units.largeSpacing

        Controls.Label {
            Layout.fillWidth: true
            text: i18n("Let's personalize your workspace. Tell us your name and country to configure your local currency.")
            wrapMode: Text.WordWrap
            opacity: 0.75
        }

        Kirigami.FormLayout {
            Layout.fillWidth: true
            wideMode: false

            Controls.TextField {
                id: nameField
                Kirigami.FormData.label: i18n("Your Name:")
                placeholderText: i18n("e.g. John Doe")
                Layout.fillWidth: true
            }

            Controls.ComboBox {
                id: countryCombo
                Kirigami.FormData.label: i18n("Country:")
                Layout.fillWidth: true
                textRole: "label"
                valueRole: "country"
                model: SettingsMgr.countries.map(function(c) {
                    return {
                        country: c.country,
                        label: c.country + " (" + c.currencyCode + " · " + c.symbol + ")"
                    };
                })
                onActivated: {
                    dialog.selectedCountry = currentValue;
                    dialog.detectedCurrency = SettingsMgr.currencyForCountry(dialog.selectedCountry);
                }
            }
        }

        Controls.Button {
            Layout.fillWidth: true
            text: i18n("Get Started")
            icon.name: "dialog-ok-apply"
            highlighted: true
            enabled: nameField.text.trim().length > 0
            onClicked: {
                SettingsMgr.saveProfile(
                    nameField.text.trim(),
                    dialog.selectedCountry,
                    dialog.detectedCurrency.currencyCode,
                    dialog.detectedCurrency.symbol
                );
                dialog.close();
            }
        }
    }
}
