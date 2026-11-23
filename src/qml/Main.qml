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
        if (root.activeView === viewName && pageStack.depth > 0) {
            return;
        }
        root.activeView = viewName;
        switch (viewName) {
        case "dashboard":
            pageStack.replace(dashboardPageComponent);
            break;
        case "transactions":
            pageStack.replace(transactionsPageComponent);
            break;
        case "budgets":
            pageStack.replace(budgetsPageComponent);
            break;
        case "categories":
            pageStack.replace(categoriesPageComponent);
            break;
        case "loans":
            pageStack.replace(loansPageComponent);
            break;
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

    Component {
        id: dashboardPageComponent
        DashboardPage {
            onNavigateToTransactions: (filterId) => root.navigateToTransactions(filterId)
            onOpenAddTransaction: showPassiveNotification(i18n("Transaction dialog coming in Phase 5"))
            onOpenAddAccount: showPassiveNotification(i18n("Account dialog coming in Phase 5"))
            onOpenAskFinly: (prompt) => showPassiveNotification(i18n("Ask Finly drawer coming in Phase 6"))
        }
    }

    Component {
        id: transactionsPageComponent
        TransactionsPage {
            onOpenAddTransaction: showPassiveNotification(i18n("Transaction dialog coming in Phase 5"))
            onOpenEditTransaction: (txData) => showPassiveNotification(i18n("Edit transaction coming in Phase 5"))
            onOpenImportCSV: showPassiveNotification(i18n("CSV Import coming in Phase 5"))
            onExportCSV: showPassiveNotification(i18n("CSV Export coming in Phase 6"))
            onOpenAskFinly: (prompt) => showPassiveNotification(i18n("Ask Finly drawer coming in Phase 6"))
        }
    }

    Component {
        id: budgetsPageComponent
        BudgetsPage {
            onOpenAddBudget: showPassiveNotification(i18n("Budget dialog coming in Phase 5"))
            onOpenEditBudget: (budgetData) => showPassiveNotification(i18n("Edit budget coming in Phase 5"))
            onNavigateToCategoryTransactions: (catName) => root.navigateToTransactions("category:" + catName)
        }
    }

    Component {
        id: categoriesPageComponent
        CategoriesPage {
            onOpenAddCategory: showPassiveNotification(i18n("Category dialog coming in Phase 5"))
            onOpenEditCategory: (catData) => showPassiveNotification(i18n("Edit category coming in Phase 5"))
            onOpenDeleteCategory: (catData) => showPassiveNotification(i18n("Delete category dialog coming in Phase 5"))
            onNavigateToCategoryTransactions: (catName) => root.navigateToTransactions("category:" + catName)
        }
    }

    Component {
        id: loansPageComponent
        LoansPage {
            onOpenAddLoan: showPassiveNotification(i18n("Loan dialog coming in Phase 5"))
            onOpenRecordPayment: (loanData) => showPassiveNotification(i18n("Loan payment dialog coming in Phase 5"))
        }
    }

    pageStack.initialPage: dashboardPageComponent
}
