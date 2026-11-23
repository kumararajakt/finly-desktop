add_executable(finly
    main.cpp
    core/DatabaseManager.cpp
    core/SettingsManager.cpp
    models/AccountModel.cpp
    models/TransactionModel.cpp
    models/BudgetModel.cpp
    models/CategoryModel.cpp
    models/LoanModel.cpp
)

set_source_files_properties(qml/Main.qml PROPERTIES QT_RESOURCE_ALIAS Main.qml)
set_source_files_properties(qml/GlobalSidebar.qml PROPERTIES QT_RESOURCE_ALIAS GlobalSidebar.qml)
set_source_files_properties(qml/pages/DashboardPage.qml PROPERTIES QT_RESOURCE_ALIAS DashboardPage.qml)
set_source_files_properties(qml/pages/TransactionsPage.qml PROPERTIES QT_RESOURCE_ALIAS TransactionsPage.qml)
set_source_files_properties(qml/pages/BudgetsPage.qml PROPERTIES QT_RESOURCE_ALIAS BudgetsPage.qml)
set_source_files_properties(qml/pages/CategoriesPage.qml PROPERTIES QT_RESOURCE_ALIAS CategoriesPage.qml)
set_source_files_properties(qml/pages/LoansPage.qml PROPERTIES QT_RESOURCE_ALIAS LoansPage.qml)

qt_add_qml_module(finly
    URI com.kumar.finly
    VERSION 1.0
    QML_FILES
        qml/Main.qml
        qml/GlobalSidebar.qml
        qml/pages/DashboardPage.qml
        qml/pages/TransactionsPage.qml
        qml/pages/BudgetsPage.qml
        qml/pages/CategoriesPage.qml
        qml/pages/LoansPage.qml
)

target_link_libraries(finly PRIVATE
    Qt6::Core
    Qt6::Quick
    Qt6::Qml
    Qt6::QuickControls2
    Qt6::Sql
    Qt6::Network
    Qt6::Widgets
    KF6::Kirigami
    KF6::I18n
    KF6::I18nQml
    KF6::CoreAddons
    KF6::ConfigCore
    KF6::Notifications
)

install(TARGETS finly ${KDE_INSTALL_TARGETS_DEFAULT_ARGS})
