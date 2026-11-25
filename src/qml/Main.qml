import QtQuick
import QtQuick.Controls as Controls
import QtQuick.Dialogs
import QtQuick.Layouts
import org.kde.kirigami as Kirigami

Kirigami.ApplicationWindow {
    id: root

    property string activeView: "dashboard"
    property string activeFilter: "all"
    property string pendingDeleteAccountId: ""
    property string pendingDeleteAccountName: ""
    readonly property bool isWidescreen: root.width >= Kirigami.Units.gridUnit * 45

    title: SettingsMgr.userName.length > 0 ? i18n("%1's Finly", SettingsMgr.userName) : i18n("Finly")
    width: SettingsMgr.windowWidth
    height: SettingsMgr.windowHeight
    minimumWidth: 360
    minimumHeight: 600

    Timer {
        id: saveGeometryTimer
        interval: 400
        onTriggered: {
            if (Qt.platform.os !== "android" && root.width >= 360 && root.height >= 600) {
                SettingsMgr.saveWindowGeometry(root.width, root.height);
            }
        }
    }

    onWidthChanged: if (Qt.platform.os !== "android") saveGeometryTimer.restart()
    onHeightChanged: if (Qt.platform.os !== "android") saveGeometryTimer.restart()

    Component.onCompleted: {
        if (!SettingsMgr.hasProfile) {
            onboardingDialog.open();
        }
    }

    onClosing: (close) => {
        if (Qt.platform.os !== "android") {
            SettingsMgr.saveWindowGeometry(root.width, root.height);
        }
        if (SettingsMgr.minimizeToTray && TraySvc.available) {
            close.accepted = false;
            root.hide();
        } else {
            Qt.quit();
        }
    }

    Connections {
        target: TraySvc
        function onShowWindowRequested() {
            root.show();
            root.raise();
            root.requestActivate();
        }
        function onToggleWindowRequested() {
            if (root.visible) {
                root.hide();
            } else {
                root.show();
                root.raise();
                root.requestActivate();
            }
        }
    }

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

    function openNewTransaction() {
        transactionDialog.editingTransaction = null;
        transactionDialog.open();
    }

    function openEditTransactionDialog(txData) {
        transactionDialog.editingTransaction = txData;
        transactionDialog.open();
    }

    function openAskFinlyDrawer(prompt, attached) {
        if (!SettingsMgr.aiEnabled) {
            return;
        }
        askFinlyDrawer.initialPrompt = prompt || "";
        askFinlyDrawer.attachedTransactions = attached || [];
        askFinlyDrawer.open();
    }

    globalDrawer: GlobalSidebar {
        activeView: root.activeView
        activeFilter: root.activeFilter

        onSelectView: (view) => root.navigateToView(view)
        onSelectFilter: (filterId) => root.navigateToTransactions(filterId)
        onOpenAddTransaction: root.openNewTransaction()
        onOpenAddAccount: {
            accountDialog.editingAccount = null;
            accountDialog.open();
        }
        onOpenSettings: {
            settingsDialog.activeTab = 0;
            settingsDialog.open();
        }
        onOpenAskFinly: root.openAskFinlyDrawer("", [])
        onRequestEditAccount: (accountData) => {
            accountDialog.editingAccount = accountData;
            accountDialog.open();
        }
        onRequestDeleteAccount: (accountId, accountName) => {
            root.pendingDeleteAccountId = accountId;
            root.pendingDeleteAccountName = accountName;
            deleteAccountPrompt.open();
        }
    }

    AskFinlyDrawer {
        id: askFinlyDrawer
        onOpenAiSettings: {
            settingsDialog.activeTab = 1;
            settingsDialog.open();
        }
    }

    FileDialog {
        id: csvExportDialog
        title: i18n("Export Transactions to CSV")
        fileMode: FileDialog.SaveFile
        nameFilters: [i18n("CSV Files (*.csv)")]
        onAccepted: {
            var saved = CsvSvc.exportTransactionsToCsv(TransactionFilter, selectedFile.toString());
            if (saved && saved.length > 0) {
                showPassiveNotification(i18n("Exported to %1", saved));
            }
        }
    }

    // --- Dialogs ---
    OnboardingDialog { id: onboardingDialog }
    AccountDialog {
        id: accountDialog
        onAccountRenamed: (oldName, newName) => {
            if (root.activeFilter === "account:" + oldName) {
                root.activeFilter = "account:" + newName;
                TransactionFilter.filterAccount = newName;
            }
        }
    }
    TransactionDialog { id: transactionDialog }
    BudgetDialog { id: budgetDialog }
    CategoryDialog { id: categoryDialog }
    DeleteCategoryDialog { id: deleteCategoryDialog }
    LoanDialog { id: loanDialog }
    LoanPaymentDialog { id: loanPaymentDialog }
    SettingsDialog { id: settingsDialog }
    ImportCsvDialog { id: importCsvDialog }

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

    // --- Pages ---
    Component {
        id: dashboardPageComponent
        DashboardPage {
            onNavigateToTransactions: (filterId) => root.navigateToTransactions(filterId)
            onOpenAddTransaction: root.openNewTransaction()
            onOpenAddAccount: {
                accountDialog.editingAccount = null;
                accountDialog.open();
            }
            onOpenAskFinly: (prompt) => root.openAskFinlyDrawer(prompt, [])
            onRequestEditAccount: (accountData) => {
                accountDialog.editingAccount = accountData;
                accountDialog.open();
            }
            onRequestDeleteAccount: (accountId, accountName) => {
                root.pendingDeleteAccountId = accountId;
                root.pendingDeleteAccountName = accountName;
                deleteAccountPrompt.open();
            }
        }
    }

    Component {
        id: transactionsPageComponent
        TransactionsPage {
            onOpenAddTransaction: root.openNewTransaction()
            onOpenEditTransaction: (txData) => root.openEditTransactionDialog(txData)
            onOpenImportCSV: importCsvDialog.open()
            onExportCSV: csvExportDialog.open()
            onOpenAskFinly: (prompt) => root.openAskFinlyDrawer(prompt, [])
        }
    }

    Component {
        id: budgetsPageComponent
        BudgetsPage {
            onOpenAddBudget: {
                budgetDialog.editingBudget = null;
                budgetDialog.open();
            }
            onOpenEditBudget: (budgetData) => {
                budgetDialog.editingBudget = budgetData;
                budgetDialog.open();
            }
            onNavigateToCategoryTransactions: (catName) => root.navigateToTransactions("category:" + catName)
        }
    }

    Component {
        id: categoriesPageComponent
        CategoriesPage {
            onOpenAddCategory: {
                categoryDialog.editingCategory = null;
                categoryDialog.open();
            }
            onOpenEditCategory: (catData) => {
                categoryDialog.editingCategory = catData;
                categoryDialog.open();
            }
            onOpenDeleteCategory: (catData) => {
                deleteCategoryDialog.targetCategory = catData;
                deleteCategoryDialog.open();
            }
            onNavigateToCategoryTransactions: (catName) => root.navigateToTransactions("category:" + catName)
        }
    }

    Component {
        id: loansPageComponent
        LoansPage {
            onOpenAddLoan: loanDialog.open()
            onOpenRecordPayment: (loanData) => {
                loanPaymentDialog.targetLoan = loanData;
                loanPaymentDialog.open();
            }
        }
    }

    pageStack.globalToolBar.style: Kirigami.ApplicationHeaderStyle.ToolBar
    pageStack.initialPage: dashboardPageComponent
}
