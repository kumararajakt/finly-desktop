qt_add_executable(finly
    main.cpp
    core/DatabaseManager.cpp
    core/SettingsManager.cpp
    models/AccountModel.cpp
    models/TransactionModel.cpp
    models/BudgetModel.cpp
    models/CategoryModel.cpp
    models/LoanModel.cpp
    services/CsvService.cpp
    services/NotificationService.cpp
    services/ReminderService.cpp
    services/TrayService.cpp
    services/AiService.cpp
)

qt_add_resources(finly "finly_icons"
    PREFIX "/icons"
    BASE "${CMAKE_SOURCE_DIR}"
    FILES
        "${CMAKE_SOURCE_DIR}/com.kumar.finly.svg"
        "${CMAKE_SOURCE_DIR}/menu.svg"
)

if(ANDROID)
    file(GLOB ANDROID_ICON_SVGS "${CMAKE_CURRENT_SOURCE_DIR}/android-icons/actions/22/*.svg")
    qt_add_resources(finly "finly_android_icons"
        PREFIX "/icons/breeze"
        BASE "${CMAKE_CURRENT_SOURCE_DIR}/android-icons"
        FILES
            "${CMAKE_CURRENT_SOURCE_DIR}/android-icons/index.theme"
            ${ANDROID_ICON_SVGS}
    )
endif()

set_source_files_properties(qml/Main.qml PROPERTIES QT_RESOURCE_ALIAS Main.qml)
set_source_files_properties(qml/GlobalSidebar.qml PROPERTIES QT_RESOURCE_ALIAS GlobalSidebar.qml)
set_source_files_properties(qml/AskFinlyDrawer.qml PROPERTIES QT_RESOURCE_ALIAS AskFinlyDrawer.qml)
set_source_files_properties(qml/pages/DashboardPage.qml PROPERTIES QT_RESOURCE_ALIAS DashboardPage.qml)
set_source_files_properties(qml/pages/TransactionsPage.qml PROPERTIES QT_RESOURCE_ALIAS TransactionsPage.qml)
set_source_files_properties(qml/pages/BudgetsPage.qml PROPERTIES QT_RESOURCE_ALIAS BudgetsPage.qml)
set_source_files_properties(qml/pages/CategoriesPage.qml PROPERTIES QT_RESOURCE_ALIAS CategoriesPage.qml)
set_source_files_properties(qml/pages/LoansPage.qml PROPERTIES QT_RESOURCE_ALIAS LoansPage.qml)
set_source_files_properties(qml/dialogs/OnboardingDialog.qml PROPERTIES QT_RESOURCE_ALIAS OnboardingDialog.qml)
set_source_files_properties(qml/dialogs/AccountDialog.qml PROPERTIES QT_RESOURCE_ALIAS AccountDialog.qml)
set_source_files_properties(qml/dialogs/TransactionDialog.qml PROPERTIES QT_RESOURCE_ALIAS TransactionDialog.qml)
set_source_files_properties(qml/dialogs/BudgetDialog.qml PROPERTIES QT_RESOURCE_ALIAS BudgetDialog.qml)
set_source_files_properties(qml/dialogs/CategoryDialog.qml PROPERTIES QT_RESOURCE_ALIAS CategoryDialog.qml)
set_source_files_properties(qml/dialogs/DeleteCategoryDialog.qml PROPERTIES QT_RESOURCE_ALIAS DeleteCategoryDialog.qml)
set_source_files_properties(qml/dialogs/LoanDialog.qml PROPERTIES QT_RESOURCE_ALIAS LoanDialog.qml)
set_source_files_properties(qml/dialogs/LoanPaymentDialog.qml PROPERTIES QT_RESOURCE_ALIAS LoanPaymentDialog.qml)
set_source_files_properties(qml/dialogs/SettingsDialog.qml PROPERTIES QT_RESOURCE_ALIAS SettingsDialog.qml)
set_source_files_properties(qml/dialogs/ReminderScheduleDialog.qml PROPERTIES QT_RESOURCE_ALIAS ReminderScheduleDialog.qml)
set_source_files_properties(qml/dialogs/ImportCsvDialog.qml PROPERTIES QT_RESOURCE_ALIAS ImportCsvDialog.qml)

qt_add_qml_module(finly
    URI com.kumar.finly
    VERSION 1.0
    QML_FILES
        qml/Main.qml
        qml/GlobalSidebar.qml
        qml/AskFinlyDrawer.qml
        qml/pages/DashboardPage.qml
        qml/pages/TransactionsPage.qml
        qml/pages/BudgetsPage.qml
        qml/pages/CategoriesPage.qml
        qml/pages/LoansPage.qml
        qml/dialogs/OnboardingDialog.qml
        qml/dialogs/AccountDialog.qml
        qml/dialogs/TransactionDialog.qml
        qml/dialogs/BudgetDialog.qml
        qml/dialogs/CategoryDialog.qml
        qml/dialogs/DeleteCategoryDialog.qml
        qml/dialogs/LoanDialog.qml
        qml/dialogs/LoanPaymentDialog.qml
        qml/dialogs/SettingsDialog.qml
        qml/dialogs/ReminderScheduleDialog.qml
        qml/dialogs/ImportCsvDialog.qml
)

target_link_libraries(finly PRIVATE
    Qt6::Core
    Qt6::Quick
    Qt6::Qml
    Qt6::QuickControls2
    Qt6::Sql
    Qt6::Network
    KF6::Kirigami
    KF6::I18n
    KF6::I18nQml
    KF6::CoreAddons
    KF6::ConfigCore
    KF6::Notifications
)

if(NOT ANDROID)
    target_link_libraries(finly PRIVATE Qt6::Widgets)
endif()

if(ANDROID)
    ecm_add_android_apk(finly
        ANDROID_DIR "${CMAKE_SOURCE_DIR}/android"
        PACKAGE_NAME "com.kumar.finly"
    )
endif()

install(TARGETS finly ${KDE_INSTALL_TARGETS_DEFAULT_ARGS})
