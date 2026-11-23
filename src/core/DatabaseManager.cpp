#include "DatabaseManager.h"

#include <QDir>
#include <QFileInfo>
#include <QMutexLocker>
#include <QSqlError>
#include <QSqlQuery>
#include <QStandardPaths>
#include <QUuid>
#include <cmath>

namespace Finly {

DatabaseManager::DatabaseManager(QObject *parent)
    : QObject(parent)
    , m_connectionName(QStringLiteral("finly_sqlite_") + QUuid::createUuid().toString(QUuid::Id128))
{
}

DatabaseManager::~DatabaseManager()
{
    if (QSqlDatabase::contains(m_connectionName)) {
        {
            QSqlDatabase db = QSqlDatabase::database(m_connectionName);
            if (db.isOpen()) {
                db.close();
            }
        }
        QSqlDatabase::removeDatabase(m_connectionName);
    }
}

bool DatabaseManager::initialize(const QString &dbPath)
{
    QMutexLocker locker(&m_mutex);

    QString resolvedPath = dbPath;
    if (resolvedPath.isEmpty()) {
        const QString dataDir = QStandardPaths::writableLocation(QStandardPaths::AppDataLocation);
        QDir().mkpath(dataDir);
        resolvedPath = dataDir + QStringLiteral("/finly.db");
    } else {
        QDir().mkpath(QFileInfo(resolvedPath).absolutePath());
    }

    QSqlDatabase db = QSqlDatabase::addDatabase(QStringLiteral("QSQLITE"), m_connectionName);
    db.setDatabaseName(resolvedPath);

    if (!db.open()) {
        m_lastError = db.lastError().text();
        return false;
    }

    QSqlQuery query(db);
    const QStringList pragmas = {
        QStringLiteral("PRAGMA journal_mode = WAL;"),
        QStringLiteral("PRAGMA synchronous = NORMAL;"),
        QStringLiteral("PRAGMA foreign_keys = ON;")
    };
    for (const QString &p : pragmas) {
        if (!query.exec(p)) {
            m_lastError = query.lastError().text();
            return false;
        }
    }

    if (!query.exec(QStringLiteral(
            "CREATE TABLE IF NOT EXISTS accounts ("
            "  id TEXT PRIMARY KEY,"
            "  name TEXT NOT NULL UNIQUE,"
            "  account_type TEXT NOT NULL,"
            "  balance REAL NOT NULL DEFAULT 0.0,"
            "  created_at DATETIME DEFAULT CURRENT_TIMESTAMP"
            ")"))) {
        m_lastError = query.lastError().text();
        return false;
    }

    if (!query.exec(QStringLiteral(
            "CREATE TABLE IF NOT EXISTS transactions ("
            "  id TEXT PRIMARY KEY,"
            "  date TEXT NOT NULL,"
            "  payee TEXT NOT NULL,"
            "  category TEXT NOT NULL,"
            "  category_color TEXT,"
            "  account TEXT NOT NULL,"
            "  to_account TEXT,"
            "  amount REAL NOT NULL,"
            "  tx_type TEXT NOT NULL,"
            "  status TEXT NOT NULL,"
            "  notes TEXT,"
            "  created_at DATETIME DEFAULT CURRENT_TIMESTAMP"
            ")"))) {
        m_lastError = query.lastError().text();
        return false;
    }

    if (!query.exec(QStringLiteral(
            "CREATE TABLE IF NOT EXISTS settings ("
            "  key TEXT PRIMARY KEY,"
            "  value TEXT NOT NULL"
            ")"))) {
        m_lastError = query.lastError().text();
        return false;
    }

    // Ensure to_account column exists for older schemas
    query.exec(QStringLiteral("ALTER TABLE transactions ADD COLUMN to_account TEXT"));

    query.exec(QStringLiteral("CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions (date DESC)"));
    query.exec(QStringLiteral("CREATE INDEX IF NOT EXISTS idx_transactions_account ON transactions (account)"));
    query.exec(QStringLiteral("CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions (status)"));

    return true;
}

bool DatabaseManager::isOpen() const
{
    QMutexLocker locker(&m_mutex);
    return QSqlDatabase::database(m_connectionName, false).isOpen();
}

QString DatabaseManager::lastError() const
{
    return m_lastError;
}

QString DatabaseManager::inferAccountType(const QString &accountName) const
{
    const QString lower = accountName.toLower();
    if (lower.contains(QStringLiteral("credit"))) {
        return QStringLiteral("credit");
    }
    if (lower.contains(QStringLiteral("invest")) || lower.contains(QStringLiteral("broker"))
        || lower.contains(QStringLiteral("stock")) || lower.contains(QStringLiteral("demat"))
        || lower.contains(QStringLiteral("portfolio"))) {
        return QStringLiteral("investment");
    }
    if (lower.contains(QStringLiteral("saving"))) {
        return QStringLiteral("savings");
    }
    return QStringLiteral("checking");
}

bool DatabaseManager::applyTransactionBalanceEffect(QSqlDatabase &db, const Transaction &txData, bool revert)
{
    QSqlQuery q(db);
    const double sign = revert ? -1.0 : 1.0;

    if (txData.type == QStringLiteral("transfer")) {
        const QString toAcc = txData.toAccount.trimmed();
        if (!toAcc.isEmpty()) {
            const double transferAmt = std::abs(txData.amount);
            q.prepare(QStringLiteral("UPDATE accounts SET balance = balance + ? WHERE name = ?"));
            q.addBindValue(-sign * transferAmt);
            q.addBindValue(txData.account);
            if (!q.exec()) {
                m_lastError = q.lastError().text();
                return false;
            }

            q.prepare(QStringLiteral("UPDATE accounts SET balance = balance + ? WHERE name = ?"));
            q.addBindValue(sign * transferAmt);
            q.addBindValue(toAcc);
            if (!q.exec()) {
                m_lastError = q.lastError().text();
                return false;
            }
            if (!revert && q.numRowsAffected() == 0) {
                q.prepare(QStringLiteral("INSERT INTO accounts (id, name, account_type, balance) VALUES (?, ?, ?, ?)"));
                q.addBindValue(QUuid::createUuid().toString(QUuid::WithoutBraces));
                q.addBindValue(toAcc);
                q.addBindValue(inferAccountType(toAcc));
                q.addBindValue(transferAmt);
                if (!q.exec()) {
                    m_lastError = q.lastError().text();
                    return false;
                }
            }
        } else {
            q.prepare(QStringLiteral("UPDATE accounts SET balance = balance + ? WHERE name = ?"));
            q.addBindValue(sign * txData.amount);
            q.addBindValue(txData.account);
            if (!q.exec()) {
                m_lastError = q.lastError().text();
                return false;
            }
        }
    } else {
        q.prepare(QStringLiteral("UPDATE accounts SET balance = balance + ? WHERE name = ?"));
        q.addBindValue(sign * txData.amount);
        q.addBindValue(txData.account);
        if (!q.exec()) {
            m_lastError = q.lastError().text();
            return false;
        }
        if (!revert && q.numRowsAffected() == 0) {
            q.prepare(QStringLiteral("INSERT INTO accounts (id, name, account_type, balance) VALUES (?, ?, ?, ?)"));
            q.addBindValue(QUuid::createUuid().toString(QUuid::WithoutBraces));
            q.addBindValue(txData.account);
            q.addBindValue(inferAccountType(txData.account));
            q.addBindValue(txData.amount);
            if (!q.exec()) {
                m_lastError = q.lastError().text();
                return false;
            }
        }
    }
    return true;
}

QVector<Transaction> DatabaseManager::getTransactions()
{
    QMutexLocker locker(&m_mutex);
    QVector<Transaction> result;
    QSqlDatabase db = QSqlDatabase::database(m_connectionName);
    QSqlQuery q(db);

    if (!q.exec(QStringLiteral(
            "SELECT id, date, payee, category, category_color, account, to_account, amount, tx_type, status, notes "
            "FROM transactions ORDER BY date DESC, created_at DESC"))) {
        m_lastError = q.lastError().text();
        return result;
    }

    while (q.next()) {
        Transaction t;
        t.id = q.value(0).toString();
        t.date = q.value(1).toString();
        t.payee = q.value(2).toString();
        t.category = q.value(3).toString();
        t.categoryColor = q.value(4).toString();
        t.account = q.value(5).toString();
        t.toAccount = q.value(6).toString();
        t.amount = q.value(7).toDouble();
        t.type = q.value(8).toString();
        t.status = q.value(9).toString();
        t.notes = q.value(10).toString();
        result.append(t);
    }
    return result;
}

std::optional<Transaction> DatabaseManager::addTransaction(const Transaction &newTx)
{
    QMutexLocker locker(&m_mutex);
    QSqlDatabase db = QSqlDatabase::database(m_connectionName);
    if (!db.transaction()) {
        m_lastError = db.lastError().text();
        return std::nullopt;
    }

    Transaction created = newTx;
    if (created.id.isEmpty()) {
        created.id = QUuid::createUuid().toString(QUuid::WithoutBraces);
    }

    QSqlQuery q(db);
    q.prepare(QStringLiteral(
        "INSERT INTO transactions (id, date, payee, category, category_color, account, to_account, amount, tx_type, status, notes) "
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"));
    q.addBindValue(created.id);
    q.addBindValue(created.date);
    q.addBindValue(created.payee);
    q.addBindValue(created.category);
    q.addBindValue(created.categoryColor.isEmpty() ? QVariant() : created.categoryColor);
    q.addBindValue(created.account);
    q.addBindValue(created.toAccount.isEmpty() ? QVariant() : created.toAccount);
    q.addBindValue(created.amount);
    q.addBindValue(created.type);
    q.addBindValue(created.status);
    q.addBindValue(created.notes.isEmpty() ? QVariant() : created.notes);

    if (!q.exec()) {
        m_lastError = q.lastError().text();
        db.rollback();
        return std::nullopt;
    }

    if (!applyTransactionBalanceEffect(db, created, false)) {
        db.rollback();
        return std::nullopt;
    }

    if (!db.commit()) {
        m_lastError = db.lastError().text();
        return std::nullopt;
    }
    return created;
}

std::optional<Transaction> DatabaseManager::updateTransaction(const Transaction &txData)
{
    QMutexLocker locker(&m_mutex);
    QSqlDatabase db = QSqlDatabase::database(m_connectionName);
    if (!db.transaction()) {
        m_lastError = db.lastError().text();
        return std::nullopt;
    }

    QSqlQuery q(db);
    q.prepare(QStringLiteral("SELECT account, to_account, amount, tx_type FROM transactions WHERE id = ?"));
    q.addBindValue(txData.id);
    if (q.exec() && q.next()) {
        Transaction oldTx;
        oldTx.account = q.value(0).toString();
        oldTx.toAccount = q.value(1).toString();
        oldTx.amount = q.value(2).toDouble();
        oldTx.type = q.value(3).toString();
        if (!applyTransactionBalanceEffect(db, oldTx, true)) {
            db.rollback();
            return std::nullopt;
        }
    }

    if (!applyTransactionBalanceEffect(db, txData, false)) {
        db.rollback();
        return std::nullopt;
    }

    q.prepare(QStringLiteral(
        "UPDATE transactions "
        "SET date = ?, payee = ?, category = ?, category_color = ?, account = ?, to_account = ?, "
        "    amount = ?, tx_type = ?, status = ?, notes = ? "
        "WHERE id = ?"));
    q.addBindValue(txData.date);
    q.addBindValue(txData.payee);
    q.addBindValue(txData.category);
    q.addBindValue(txData.categoryColor.isEmpty() ? QVariant() : txData.categoryColor);
    q.addBindValue(txData.account);
    q.addBindValue(txData.toAccount.isEmpty() ? QVariant() : txData.toAccount);
    q.addBindValue(txData.amount);
    q.addBindValue(txData.type);
    q.addBindValue(txData.status);
    q.addBindValue(txData.notes.isEmpty() ? QVariant() : txData.notes);
    q.addBindValue(txData.id);

    if (!q.exec()) {
        m_lastError = q.lastError().text();
        db.rollback();
        return std::nullopt;
    }

    if (!db.commit()) {
        m_lastError = db.lastError().text();
        return std::nullopt;
    }
    return txData;
}

bool DatabaseManager::deleteTransaction(const QString &id)
{
    QMutexLocker locker(&m_mutex);
    QSqlDatabase db = QSqlDatabase::database(m_connectionName);
    if (!db.transaction()) {
        m_lastError = db.lastError().text();
        return false;
    }

    QSqlQuery q(db);
    q.prepare(QStringLiteral("SELECT account, to_account, amount, tx_type FROM transactions WHERE id = ?"));
    q.addBindValue(id);
    if (!q.exec() || !q.next()) {
        db.rollback();
        return false;
    }

    Transaction oldTx;
    oldTx.account = q.value(0).toString();
    oldTx.toAccount = q.value(1).toString();
    oldTx.amount = q.value(2).toDouble();
    oldTx.type = q.value(3).toString();

    if (!applyTransactionBalanceEffect(db, oldTx, true)) {
        db.rollback();
        return false;
    }

    q.prepare(QStringLiteral("DELETE FROM transactions WHERE id = ?"));
    q.addBindValue(id);
    if (!q.exec()) {
        m_lastError = q.lastError().text();
        db.rollback();
        return false;
    }

    return db.commit();
}

QString DatabaseManager::toggleFlagTransaction(const QString &id)
{
    QMutexLocker locker(&m_mutex);
    QSqlDatabase db = QSqlDatabase::database(m_connectionName);
    QSqlQuery q(db);

    q.prepare(QStringLiteral("SELECT status FROM transactions WHERE id = ?"));
    q.addBindValue(id);
    if (!q.exec() || !q.next()) {
        return QString();
    }

    const QString current = q.value(0).toString();
    const QString next = (current == QStringLiteral("flagged")) ? QStringLiteral("cleared") : QStringLiteral("flagged");

    q.prepare(QStringLiteral("UPDATE transactions SET status = ? WHERE id = ?"));
    q.addBindValue(next);
    q.addBindValue(id);
    if (!q.exec()) {
        m_lastError = q.lastError().text();
        return current;
    }
    return next;
}

int DatabaseManager::importTransactions(const QVector<Transaction> &transactions)
{
    QMutexLocker locker(&m_mutex);
    QSqlDatabase db = QSqlDatabase::database(m_connectionName);
    if (!db.transaction()) {
        m_lastError = db.lastError().text();
        return 0;
    }

    int count = 0;
    for (const Transaction &txItem : transactions) {
        Transaction created = txItem;
        if (created.id.isEmpty()) {
            created.id = QUuid::createUuid().toString(QUuid::WithoutBraces);
        }

        QSqlQuery q(db);
        q.prepare(QStringLiteral(
            "INSERT INTO transactions (id, date, payee, category, category_color, account, to_account, amount, tx_type, status, notes) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"));
        q.addBindValue(created.id);
        q.addBindValue(created.date);
        q.addBindValue(created.payee);
        q.addBindValue(created.category);
        q.addBindValue(created.categoryColor.isEmpty() ? QVariant() : created.categoryColor);
        q.addBindValue(created.account);
        q.addBindValue(created.toAccount.isEmpty() ? QVariant() : created.toAccount);
        q.addBindValue(created.amount);
        q.addBindValue(created.type);
        q.addBindValue(created.status);
        q.addBindValue(created.notes.isEmpty() ? QVariant() : created.notes);

        if (!q.exec() || !applyTransactionBalanceEffect(db, created, false)) {
            m_lastError = q.lastError().text();
            db.rollback();
            return 0;
        }
        ++count;
    }

    if (!db.commit()) {
        m_lastError = db.lastError().text();
        return 0;
    }
    return count;
}

bool DatabaseManager::reassignCategoryTransactions(const QString &oldCategory, const QString &newCategory, const QString &newColor)
{
    QMutexLocker locker(&m_mutex);
    QSqlDatabase db = QSqlDatabase::database(m_connectionName);
    QSqlQuery q(db);
    q.prepare(QStringLiteral("UPDATE transactions SET category = ?, category_color = ? WHERE LOWER(TRIM(category)) = LOWER(TRIM(?))"));
    q.addBindValue(newCategory);
    q.addBindValue(newColor);
    q.addBindValue(oldCategory);
    if (!q.exec()) {
        m_lastError = q.lastError().text();
        return false;
    }
    return true;
}

QVector<Account> DatabaseManager::getAccounts()
{
    QMutexLocker locker(&m_mutex);
    QVector<Account> result;
    QSqlDatabase db = QSqlDatabase::database(m_connectionName);
    QSqlQuery q(db);

    if (!q.exec(QStringLiteral("SELECT id, name, account_type, balance FROM accounts ORDER BY created_at ASC"))) {
        m_lastError = q.lastError().text();
        return result;
    }

    while (q.next()) {
        Account acc;
        acc.id = q.value(0).toString();
        acc.name = q.value(1).toString();
        acc.type = q.value(2).toString();
        acc.balance = q.value(3).toDouble();
        result.append(acc);
    }
    return result;
}

std::optional<Account> DatabaseManager::addAccount(const QString &name, const QString &type, double balance)
{
    QMutexLocker locker(&m_mutex);
    QSqlDatabase db = QSqlDatabase::database(m_connectionName);
    QSqlQuery q(db);

    Account acc;
    acc.id = QUuid::createUuid().toString(QUuid::WithoutBraces);
    acc.name = name.trimmed();
    acc.type = type;
    acc.balance = balance;

    q.prepare(QStringLiteral("INSERT INTO accounts (id, name, account_type, balance) VALUES (?, ?, ?, ?)"));
    q.addBindValue(acc.id);
    q.addBindValue(acc.name);
    q.addBindValue(acc.type);
    q.addBindValue(acc.balance);

    if (!q.exec()) {
        m_lastError = q.lastError().text();
        return std::nullopt;
    }
    return acc;
}

bool DatabaseManager::deleteAccount(const QString &idOrName)
{
    QMutexLocker locker(&m_mutex);
    QSqlDatabase db = QSqlDatabase::database(m_connectionName);
    QSqlQuery q(db);
    q.prepare(QStringLiteral("DELETE FROM accounts WHERE id = ? OR name = ?"));
    q.addBindValue(idOrName);
    q.addBindValue(idOrName);
    if (!q.exec()) {
        m_lastError = q.lastError().text();
        return false;
    }
    return q.numRowsAffected() > 0;
}

std::optional<QString> DatabaseManager::getSetting(const QString &key)
{
    QMutexLocker locker(&m_mutex);
    QSqlDatabase db = QSqlDatabase::database(m_connectionName);
    QSqlQuery q(db);
    q.prepare(QStringLiteral("SELECT value FROM settings WHERE key = ?"));
    q.addBindValue(key);
    if (q.exec() && q.next()) {
        return q.value(0).toString();
    }
    return std::nullopt;
}

bool DatabaseManager::setSetting(const QString &key, const QString &value)
{
    QMutexLocker locker(&m_mutex);
    QSqlDatabase db = QSqlDatabase::database(m_connectionName);
    QSqlQuery q(db);
    q.prepare(QStringLiteral("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"));
    q.addBindValue(key);
    q.addBindValue(value);
    if (!q.exec()) {
        m_lastError = q.lastError().text();
        return false;
    }
    return true;
}

} // namespace Finly
