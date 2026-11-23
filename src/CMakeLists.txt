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

set_source_files_properties(qml/Main.qml PROPERTIES
    QT_RESOURCE_ALIAS Main.qml
)

qt_add_qml_module(finly
    URI com.kumar.finly
    VERSION 1.0
    QML_FILES
        qml/Main.qml
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
