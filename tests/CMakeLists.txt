find_package(Qt6 ${QT_MIN_VERSION} REQUIRED COMPONENTS Test)

add_executable(finly_tests
    test_finly.cpp
    ${CMAKE_SOURCE_DIR}/src/core/DatabaseManager.cpp
    ${CMAKE_SOURCE_DIR}/src/core/SettingsManager.cpp
    ${CMAKE_SOURCE_DIR}/src/models/AccountModel.cpp
    ${CMAKE_SOURCE_DIR}/src/models/TransactionModel.cpp
    ${CMAKE_SOURCE_DIR}/src/models/BudgetModel.cpp
    ${CMAKE_SOURCE_DIR}/src/models/CategoryModel.cpp
    ${CMAKE_SOURCE_DIR}/src/models/LoanModel.cpp
    ${CMAKE_SOURCE_DIR}/src/services/CsvService.cpp
)

target_include_directories(finly_tests PRIVATE ${CMAKE_SOURCE_DIR}/src)

target_link_libraries(finly_tests PRIVATE
    Qt6::Core
    Qt6::Test
    Qt6::Sql
)

add_test(NAME finly_tests COMMAND finly_tests)
