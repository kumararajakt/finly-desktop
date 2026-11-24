#include <QTemporaryDir>
#include <QtTest>

#include "core/DatabaseManager.h"
#include "core/SettingsManager.h"
#include "models/AccountModel.h"
#include "models/BudgetModel.h"
#include "models/CategoryModel.h"
#include "models/LoanModel.h"
#include "models/TransactionModel.h"
#include "services/CsvService.h"

using namespace Finly;

class FinlyTests : public QObject
{
    Q_OBJECT

private Q_SLOTS:
    void testDatabaseAndAccounts()
    {
        QTemporaryDir dir;
        QVERIFY(dir.isValid());

        DatabaseManager db;
        QVERIFY(db.initialize(dir.filePath(QStringLiteral("test.db"))));

        AccountModel accounts(&db);
        QVERIFY(accounts.addAccount(QStringLiteral("Checking"), QStringLiteral("checking"), 1000.0));
        QVERIFY(accounts.addAccount(QStringLiteral("Visa"), QStringLiteral("credit"), 200.0));
        QCOMPARE(accounts.rowCount(), 2);
        QCOMPARE(accounts.totalAssets(), 1000.0);
        QCOMPARE(accounts.totalLiabilities(), 200.0);
        QCOMPARE(accounts.totalNetWorth(), 800.0);
    }

    void testTransactionsAndTransfers()
    {
        QTemporaryDir dir;
        QVERIFY(dir.isValid());

        DatabaseManager db;
        QVERIFY(db.initialize(dir.filePath(QStringLiteral("test.db"))));

        AccountModel accounts(&db);
        accounts.addAccount(QStringLiteral("Checking"), QStringLiteral("checking"), 1000.0);
        accounts.addAccount(QStringLiteral("Savings"), QStringLiteral("savings"), 500.0);

        TransactionModel txs(&db, &accounts);
        QVERIFY(txs.addTransaction({
            {QStringLiteral("date"), QStringLiteral("2026-11-01")},
            {QStringLiteral("payee"), QStringLiteral("Grocery Store")},
            {QStringLiteral("category"), QStringLiteral("Groceries")},
            {QStringLiteral("account"), QStringLiteral("Checking")},
            {QStringLiteral("amount"), -150.0},
            {QStringLiteral("type"), QStringLiteral("expense")},
            {QStringLiteral("status"), QStringLiteral("cleared")},
        }));

        QVERIFY(txs.addTransaction({
            {QStringLiteral("date"), QStringLiteral("2026-11-02")},
            {QStringLiteral("payee"), QStringLiteral("Transfer to Savings")},
            {QStringLiteral("category"), QStringLiteral("Transfer")},
            {QStringLiteral("account"), QStringLiteral("Checking")},
            {QStringLiteral("toAccount"), QStringLiteral("Savings")},
            {QStringLiteral("amount"), -200.0},
            {QStringLiteral("type"), QStringLiteral("transfer")},
            {QStringLiteral("status"), QStringLiteral("cleared")},
        }));

        QCOMPARE(txs.totalOutflow(), 150.0); // Transfers excluded
        QCOMPARE(txs.totalInflow(), 0.0);
        QCOMPARE(accounts.totalNetWorth(), 1350.0); // 1000 - 150 + 500
    }

    void testBudgetsAndLoans()
    {
        QTemporaryDir dir;
        QVERIFY(dir.isValid());

        DatabaseManager db;
        QVERIFY(db.initialize(dir.filePath(QStringLiteral("test.db"))));

        AccountModel accounts(&db);
        accounts.addAccount(QStringLiteral("Checking"), QStringLiteral("checking"), 1000.0);
        TransactionModel txs(&db, &accounts);

        txs.addTransaction({
            {QStringLiteral("date"), QStringLiteral("2026-11-05")},
            {QStringLiteral("payee"), QStringLiteral("Cafe")},
            {QStringLiteral("category"), QStringLiteral("Dining Out")},
            {QStringLiteral("account"), QStringLiteral("Checking")},
            {QStringLiteral("amount"), -90.0},
            {QStringLiteral("type"), QStringLiteral("expense")},
            {QStringLiteral("status"), QStringLiteral("cleared")},
        });

        BudgetModel budgets(&db, &txs);
        budgets.addBudget(QStringLiteral("Dining Out"), 100.0, QStringLiteral("#f59e0b"));
        QCOMPARE(budgets.warningCount(), 1); // 90% -> warning

        LoanModel loans(&db, &txs);
        loans.addLoan(QStringLiteral("Alex"), QStringLiteral("lent"), 100.0, QStringLiteral("Checking"),
                      QStringLiteral("2026-11-01"), QString(), QStringLiteral("Dinner split"));
        QCOMPARE(loans.totalLentOutstanding(), 100.0);
        QCOMPARE(loans.activeCount(), 1);

        const QString loanId = loans.index(0).data(LoanModel::IdRole).toString();
        loans.recordPayment(loanId, 100.0, QStringLiteral("Checking"), QStringLiteral("2026-11-10"), QStringLiteral("Settled"));
        QCOMPARE(loans.totalLentOutstanding(), 0.0);
        QCOMPARE(loans.settledCount(), 1);
    }

    void testCsvService()
    {
        CsvService csv;
        QCOMPARE(csv.normalizeDate(QStringLiteral("23/11/2026"), QStringLiteral("DD/MM/YYYY")), QStringLiteral("2026-11-23"));
        QCOMPARE(csv.normalizeDate(QStringLiteral("11/23/2026"), QStringLiteral("MM/DD/YYYY")), QStringLiteral("2026-11-23"));
        QCOMPARE(csv.guessCategory(QStringLiteral("Starbucks Coffee"), QString()), QStringLiteral("Dining Out"));
        QCOMPARE(csv.guessCategory(QStringLiteral("Monthly Salary"), QString()), QStringLiteral("Salary"));
    }
};

QTEST_MAIN(FinlyTests)
#include "test_finly.moc"
