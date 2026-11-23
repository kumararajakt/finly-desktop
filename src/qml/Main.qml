import QtQuick
import QtQuick.Controls as Controls
import QtQuick.Layouts
import org.kde.kirigami as Kirigami

Kirigami.ApplicationWindow {
    id: root

    property string activeView: "dashboard"
    property string activeFilter: "all"
    property string pendingDeleteAccountId: ""
    property string pendingDeleteAccountName: ""

    title: SettingsMgr.userName.length > 0 ? i18n("%1's Finly", SettingsMgr.userName) : i18n("Finly")
    width: 1440
    height: 900
    minimumWidth: 960
    minimumHeight: 640

    function formatMoney(amount) {
        var sym = SettingsMgr.currencySymbol || "$";
        var absVal = Math.abs(amount).toLocaleString(Qt.locale(), 'f', 2);
        return (amount < 0 ? "-" : "") + sym + absVal;
    }

    function navigateToView(viewName) {
        root.activeView = viewName;
        var titles = {
            "dashboard": i18n("Dashboard"),
            "transactions": i18n("Transactions"),
            "budgets": i18n("Budgets"),
            "categories": i18n("Categories"),
            "loans": i18n("Loans & Debts")
        };
        if (pageStack.currentItem) {
            pageStack.currentItem.title = titles[viewName] || i18n("Finly");
        }
    }

    function navigateToTransactions(filterId) {
        root.activeFilter = filterId || "all";
        TransactionFilter.activeFilter = root.activeFilter;
        navigateToView("transactions");
    }

    globalDrawer: GlobalSidebar {
        activeView: root.activeView
        activeFilter: root.activeFilter

        onSelectView: (view) => root.navigateToView(view)
        onSelectFilter: (filterId) => root.navigateToTransactions(filterId)
        onOpenAddTransaction: showPassiveNotification(i18n("Transaction dialog coming in Phase 5"))
        onOpenAddAccount: showPassiveNotification(i18n("Account dialog coming in Phase 5"))
        onOpenSettings: showPassiveNotification(i18n("Settings dialog coming in Phase 5"))
        onOpenAskFinly: showPassiveNotification(i18n("Ask Finly drawer coming in Phase 6"))
        onRequestDeleteAccount: (accountId, accountName) => {
            root.pendingDeleteAccountId = accountId;
            root.pendingDeleteAccountName = accountName;
            deleteAccountPrompt.open();
        }
    }

    Kirigami.PromptDialog {
        id: deleteAccountPrompt
        title: i18n("Delete Account")
        subtitle: i18n("Are you sure you want to delete \"%1\"?", root.pendingDeleteAccountName)
        standardButtons: Kirigami.Dialog.Ok | Kirigami.Dialog.Cancel
        onAccepted: {
            Accounts.deleteAccount(root.pendingDeleteAccountId);
            if (root.activeFilter === "account:" + root.pendingDeleteAccountName) {
                root.navigateToTransactions("all");
            }
        }
    }

    pageStack.initialPage: Kirigami.ScrollablePage {
        title: i18n("Dashboard")

        Kirigami.PlaceholderMessage {
            anchors.centerIn: parent
            width: parent.width - (Kirigami.Units.largeSpacing * 4)
            icon.name: "com.kumar.finly"
            text: i18n("Active View: %1", root.activeView)
            explanation: root.activeView === "transactions"
                ? i18n("Transactions view (filter: %1). Full pages coming in Phase 4.", root.activeFilter)
                : i18n("Sidebar and SQLite backend connected. Full pages coming in Phase 4.")
        }
    }
}
