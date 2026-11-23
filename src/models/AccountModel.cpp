#include "AccountModel.h"

#include <cmath>

namespace Finly {

AccountModel::AccountModel(DatabaseManager *db, QObject *parent)
    : QAbstractListModel(parent)
    , m_db(db)
{
}

int AccountModel::rowCount(const QModelIndex &parent) const
{
    if (parent.isValid()) {
        return 0;
    }
    return m_accounts.size();
}

QVariant AccountModel::data(const QModelIndex &index, int role) const
{
    if (!index.isValid() || index.row() < 0 || index.row() >= m_accounts.size()) {
        return {};
    }
    const Account &acc = m_accounts.at(index.row());
    switch (role) {
    case IdRole:
        return acc.id;
    case NameRole:
        return acc.name;
    case TypeRole:
        return acc.type;
    case BalanceRole:
        return acc.balance;
    default:
        return {};
    }
}

QHash<int, QByteArray> AccountModel::roleNames() const
{
    return {
        {IdRole, "accountId"},
        {NameRole, "name"},
        {TypeRole, "accountType"},
        {BalanceRole, "balance"},
    };
}

double AccountModel::totalNetWorth() const
{
    double sum = 0.0;
    for (const auto &acc : m_accounts) {
        sum += acc.balance;
    }
    return sum;
}

double AccountModel::totalAssets() const
{
    double sum = 0.0;
    for (const auto &acc : m_accounts) {
        if (acc.balance > 0.0) {
            sum += acc.balance;
        }
    }
    return sum;
}

double AccountModel::totalLiabilities() const
{
    double sum = 0.0;
    for (const auto &acc : m_accounts) {
        if (acc.balance < 0.0) {
            sum += std::abs(acc.balance);
        }
    }
    return sum;
}

void AccountModel::refresh()
{
    if (!m_db) {
        return;
    }
    beginResetModel();
    m_accounts = m_db->getAccounts();
    endResetModel();
    Q_EMIT accountsChanged();
}

bool AccountModel::addAccount(const QString &name, const QString &type, double balance)
{
    if (!m_db || name.trimmed().isEmpty()) {
        return false;
    }
    const double adjustedBalance = (type == QStringLiteral("credit") || type == QStringLiteral("loan"))
        ? -std::abs(balance)
        : balance;

    if (m_db->addAccount(name, type, adjustedBalance)) {
        refresh();
        return true;
    }
    return false;
}

bool AccountModel::deleteAccount(const QString &idOrName)
{
    if (!m_db) {
        return false;
    }
    if (m_db->deleteAccount(idOrName)) {
        refresh();
        return true;
    }
    return false;
}

QStringList AccountModel::accountNames() const
{
    QStringList names;
    names.reserve(m_accounts.size());
    for (const auto &acc : m_accounts) {
        names.append(acc.name);
    }
    return names;
}

} // namespace Finly
