#pragma once

#include "Types.h"

#include <QMutex>
#include <QObject>
#include <QSqlDatabase>
#include <QString>
#include <QVector>
#include <optional>

namespace Finly {

class DatabaseManager : public QObject
{
    Q_OBJECT

public:
    explicit DatabaseManager(QObject *parent = nullptr);
    ~DatabaseManager() override;

    bool initialize(const QString &dbPath = QString());
    bool isOpen() const;
    QString lastError() const;

    // Transactions
    QVector<Transaction> getTransactions();
    std::optional<Transaction> addTransaction(const Transaction &newTx);
    std::optional<Transaction> updateTransaction(const Transaction &txData);
    bool deleteTransaction(const QString &id);
    QString toggleFlagTransaction(const QString &id);
    int importTransactions(const QVector<Transaction> &transactions);
    bool reassignCategoryTransactions(const QString &oldCategory, const QString &newCategory, const QString &newColor);

    // Accounts
    QVector<Account> getAccounts();
    std::optional<Account> addAccount(const QString &name, const QString &type, double balance);
    bool updateAccount(const QString &id, const QString &name, const QString &type, double balance);
    bool deleteAccount(const QString &idOrName);

    // Settings (Key-Value JSON store)
    std::optional<QString> getSetting(const QString &key);
    bool setSetting(const QString &key, const QString &value);

private:
    QString inferAccountType(const QString &accountName) const;
    bool applyTransactionBalanceEffect(QSqlDatabase &db, const Transaction &txData, bool revert);

    QString m_connectionName;
    QString m_lastError;
    mutable QMutex m_mutex;
};

} // namespace Finly
