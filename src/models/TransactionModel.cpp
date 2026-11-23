#include "TransactionModel.h"

#include <QDate>
#include <QMap>
#include <algorithm>
#include <cmath>

namespace Finly {

TransactionModel::TransactionModel(DatabaseManager *db, AccountModel *accountModel, QObject *parent)
    : QAbstractListModel(parent)
    , m_db(db)
    , m_accountModel(accountModel)
{
}

int TransactionModel::rowCount(const QModelIndex &parent) const
{
    if (parent.isValid()) {
        return 0;
    }
    return m_transactions.size();
}

QVariant TransactionModel::data(const QModelIndex &index, int role) const
{
    if (!index.isValid() || index.row() < 0 || index.row() >= m_transactions.size()) {
        return {};
    }
    const Transaction &t = m_transactions.at(index.row());
    switch (role) {
    case IdRole:
        return t.id;
    case DateRole:
        return t.date;
    case PayeeRole:
        return t.payee;
    case CategoryRole:
        return t.category;
    case CategoryColorRole:
        return t.categoryColor;
    case AccountRole:
        return t.account;
    case ToAccountRole:
        return t.toAccount;
    case AmountRole:
        return t.amount;
    case TypeRole:
        return t.type;
    case StatusRole:
        return t.status;
    case NotesRole:
        return t.notes;
    default:
        return {};
    }
}

QHash<int, QByteArray> TransactionModel::roleNames() const
{
    return {
        {IdRole, "txId"},
        {DateRole, "date"},
        {PayeeRole, "payee"},
        {CategoryRole, "category"},
        {CategoryColorRole, "categoryColor"},
        {AccountRole, "account"},
        {ToAccountRole, "toAccount"},
        {AmountRole, "amount"},
        {TypeRole, "txType"},
        {StatusRole, "status"},
        {NotesRole, "notes"},
    };
}

const QVector<Transaction> &TransactionModel::items() const
{
    return m_transactions;
}

double TransactionModel::totalInflow() const
{
    double sum = 0.0;
    for (const auto &t : m_transactions) {
        if (t.amount > 0.0 && t.type != QStringLiteral("transfer")) {
            sum += t.amount;
        }
    }
    return sum;
}

double TransactionModel::totalOutflow() const
{
    double sum = 0.0;
    for (const auto &t : m_transactions) {
        if (t.amount < 0.0 && t.type != QStringLiteral("transfer")) {
            sum += std::abs(t.amount);
        }
    }
    return sum;
}

double TransactionModel::netCashFlow() const
{
    return totalInflow() - totalOutflow();
}

double TransactionModel::savingsRate() const
{
    const double inflow = totalInflow();
    if (inflow <= 0.0) {
        return 0.0;
    }
    return std::max(0.0, (netCashFlow() / inflow) * 100.0);
}

int TransactionModel::pendingCount() const
{
    int count = 0;
    for (const auto &t : m_transactions) {
        if (t.status == QStringLiteral("pending")) {
            ++count;
        }
    }
    return count;
}

int TransactionModel::flaggedCount() const
{
    int count = 0;
    for (const auto &t : m_transactions) {
        if (t.status == QStringLiteral("flagged")) {
            ++count;
        }
    }
    return count;
}

void TransactionModel::refresh()
{
    if (!m_db) {
        return;
    }
    beginResetModel();
    m_transactions = m_db->getTransactions();
    endResetModel();
    Q_EMIT transactionsChanged();
}

Transaction TransactionModel::mapToTransaction(const QVariantMap &m)
{
    Transaction t;
    t.id = m.value(QStringLiteral("id")).toString();
    t.date = m.value(QStringLiteral("date")).toString();
    t.payee = m.value(QStringLiteral("payee")).toString();
    t.category = m.value(QStringLiteral("category")).toString();
    t.categoryColor = m.value(QStringLiteral("categoryColor")).toString();
    t.account = m.value(QStringLiteral("account")).toString();
    t.toAccount = m.value(QStringLiteral("toAccount")).toString();
    t.amount = m.value(QStringLiteral("amount")).toDouble();
    t.type = m.value(QStringLiteral("type")).toString();
    t.status = m.value(QStringLiteral("status"), QStringLiteral("cleared")).toString();
    t.notes = m.value(QStringLiteral("notes")).toString();
    return t;
}

bool TransactionModel::addTransaction(const QVariantMap &txMap)
{
    if (!m_db) {
        return false;
    }
    if (m_db->addTransaction(mapToTransaction(txMap))) {
        refresh();
        if (m_accountModel) {
            m_accountModel->refresh();
        }
        return true;
    }
    return false;
}

bool TransactionModel::updateTransaction(const QVariantMap &txMap)
{
    if (!m_db) {
        return false;
    }
    if (m_db->updateTransaction(mapToTransaction(txMap))) {
        refresh();
        if (m_accountModel) {
            m_accountModel->refresh();
        }
        return true;
    }
    return false;
}

bool TransactionModel::deleteTransaction(const QString &id)
{
    if (!m_db) {
        return false;
    }
    if (m_db->deleteTransaction(id)) {
        refresh();
        if (m_accountModel) {
            m_accountModel->refresh();
        }
        return true;
    }
    return false;
}

QString TransactionModel::toggleFlagTransaction(const QString &id)
{
    if (!m_db) {
        return {};
    }
    const QString next = m_db->toggleFlagTransaction(id);
    if (!next.isEmpty()) {
        refresh();
    }
    return next;
}

int TransactionModel::importTransactions(const QVariantList &txList)
{
    if (!m_db) {
        return 0;
    }
    QVector<Transaction> items;
    items.reserve(txList.size());
    for (const QVariant &v : txList) {
        items.append(mapToTransaction(v.toMap()));
    }
    const int imported = m_db->importTransactions(items);
    if (imported > 0) {
        refresh();
        if (m_accountModel) {
            m_accountModel->refresh();
        }
    }
    return imported;
}

QVariantList TransactionModel::categoryBreakdown() const
{
    const double totalExp = totalOutflow();
    if (totalExp <= 0.0) {
        return {};
    }

    struct CatAgg {
        double total = 0.0;
        QString color = QStringLiteral("#64748b");
    };
    QMap<QString, CatAgg> map;

    for (const auto &t : m_transactions) {
        if (t.amount < 0.0 && t.type != QStringLiteral("transfer")) {
            auto &entry = map[t.category];
            entry.total += std::abs(t.amount);
            if (!t.categoryColor.isEmpty()) {
                entry.color = t.categoryColor;
            }
        }
    }

    QVector<QPair<QString, CatAgg>> sorted;
    for (auto it = map.cbegin(); it != map.cend(); ++it) {
        sorted.append({it.key(), it.value()});
    }
    std::sort(sorted.begin(), sorted.end(), [](const auto &a, const auto &b) {
        return a.second.total > b.second.total;
    });

    QVariantList result;
    for (const auto &pair : sorted) {
        result.append(QVariantMap{
            {QStringLiteral("name"), pair.first},
            {QStringLiteral("amount"), pair.second.total},
            {QStringLiteral("percentage"), qRound((pair.second.total / totalExp) * 100.0)},
            {QStringLiteral("color"), pair.second.color},
        });
    }
    return result;
}

double TransactionModel::spentForCategory(const QString &category) const
{
    double sum = 0.0;
    const QString norm = category.trimmed().toLower();
    for (const auto &t : m_transactions) {
        if (t.category.trimmed().toLower() == norm && t.amount < 0.0 && t.type != QStringLiteral("transfer")) {
            sum += std::abs(t.amount);
        }
    }
    return sum;
}

// --- TransactionFilterProxyModel ---

TransactionFilterProxyModel::TransactionFilterProxyModel(QObject *parent)
    : QSortFilterProxyModel(parent)
{
    setDynamicSortFilter(true);
}

QString TransactionFilterProxyModel::searchQuery() const { return m_searchQuery; }
void TransactionFilterProxyModel::setSearchQuery(const QString &q)
{
    if (m_searchQuery == q) return;
    m_searchQuery = q;
    invalidateFilter();
    Q_EMIT filterChanged();
}

QString TransactionFilterProxyModel::activeFilter() const { return m_activeFilter; }
void TransactionFilterProxyModel::setActiveFilter(const QString &f)
{
    if (m_activeFilter == f) return;
    m_activeFilter = f;
    invalidateFilter();
    Q_EMIT filterChanged();
}

QString TransactionFilterProxyModel::filterAccount() const { return m_filterAccount; }
void TransactionFilterProxyModel::setFilterAccount(const QString &acc)
{
    if (m_filterAccount == acc) return;
    m_filterAccount = acc;
    invalidateFilter();
    Q_EMIT filterChanged();
}

QString TransactionFilterProxyModel::filterCategory() const { return m_filterCategory; }
void TransactionFilterProxyModel::setFilterCategory(const QString &cat)
{
    if (m_filterCategory == cat) return;
    m_filterCategory = cat;
    invalidateFilter();
    Q_EMIT filterChanged();
}

QString TransactionFilterProxyModel::datePreset() const { return m_datePreset; }
void TransactionFilterProxyModel::setDatePreset(const QString &preset)
{
    if (m_datePreset == preset) return;
    m_datePreset = preset;
    invalidateFilter();
    Q_EMIT filterChanged();
}

QString TransactionFilterProxyModel::customStartDate() const { return m_customStartDate; }
void TransactionFilterProxyModel::setCustomStartDate(const QString &d)
{
    if (m_customStartDate == d) return;
    m_customStartDate = d;
    invalidateFilter();
    Q_EMIT filterChanged();
}

QString TransactionFilterProxyModel::customEndDate() const { return m_customEndDate; }
void TransactionFilterProxyModel::setCustomEndDate(const QString &d)
{
    if (m_customEndDate == d) return;
    m_customEndDate = d;
    invalidateFilter();
    Q_EMIT filterChanged();
}

QString TransactionFilterProxyModel::minAmount() const { return m_minAmount; }
void TransactionFilterProxyModel::setMinAmount(const QString &v)
{
    if (m_minAmount == v) return;
    m_minAmount = v;
    invalidateFilter();
    Q_EMIT filterChanged();
}

QString TransactionFilterProxyModel::maxAmount() const { return m_maxAmount; }
void TransactionFilterProxyModel::setMaxAmount(const QString &v)
{
    if (m_maxAmount == v) return;
    m_maxAmount = v;
    invalidateFilter();
    Q_EMIT filterChanged();
}

int TransactionFilterProxyModel::activeFiltersCount() const
{
    int count = 0;
    if (!m_filterAccount.isEmpty()) ++count;
    if (!m_filterCategory.isEmpty()) ++count;
    if (m_datePreset != QStringLiteral("all")) ++count;
    if (!m_minAmount.isEmpty()) ++count;
    if (!m_maxAmount.isEmpty()) ++count;
    return count;
}

void TransactionFilterProxyModel::clearAllFilters()
{
    m_filterAccount.clear();
    m_filterCategory.clear();
    m_datePreset = QStringLiteral("all");
    m_customStartDate.clear();
    m_customEndDate.clear();
    m_minAmount.clear();
    m_maxAmount.clear();
    invalidateFilter();
    Q_EMIT filterChanged();
}

void TransactionFilterProxyModel::sortByField(const QString &field, bool ascending)
{
    m_sortField = field;
    sort(0, ascending ? Qt::AscendingOrder : Qt::DescendingOrder);
}

bool TransactionFilterProxyModel::filterAcceptsRow(int sourceRow, const QModelIndex &sourceParent) const
{
    const QModelIndex idx = sourceModel()->index(sourceRow, 0, sourceParent);
    const QString dateStr = idx.data(TransactionModel::DateRole).toString();
    const QString payee = idx.data(TransactionModel::PayeeRole).toString();
    const QString category = idx.data(TransactionModel::CategoryRole).toString();
    const QString account = idx.data(TransactionModel::AccountRole).toString();
    const QString toAccount = idx.data(TransactionModel::ToAccountRole).toString();
    const double amount = idx.data(TransactionModel::AmountRole).toDouble();
    const QString txType = idx.data(TransactionModel::TypeRole).toString();
    const QString status = idx.data(TransactionModel::StatusRole).toString();
    const QString notes = idx.data(TransactionModel::NotesRole).toString();

    // Active filter tab / sidebar smart filter
    if (m_activeFilter == QStringLiteral("expense") && txType != QStringLiteral("expense")) return false;
    if (m_activeFilter == QStringLiteral("income") && txType != QStringLiteral("income")) return false;
    if (m_activeFilter == QStringLiteral("transfer") && txType != QStringLiteral("transfer")) return false;
    if (m_activeFilter == QStringLiteral("pending") && status != QStringLiteral("pending")) return false;
    if (m_activeFilter == QStringLiteral("cleared") && status != QStringLiteral("cleared")) return false;
    if (m_activeFilter == QStringLiteral("flagged") && status != QStringLiteral("flagged")) return false;
    if (m_activeFilter.startsWith(QStringLiteral("account:"))) {
        const QString targetAcc = m_activeFilter.mid(8);
        if (account != targetAcc && toAccount != targetAcc) return false;
    }
    if (m_activeFilter.startsWith(QStringLiteral("category:"))) {
        const QString targetCat = m_activeFilter.mid(9);
        if (category.compare(targetCat, Qt::CaseInsensitive) != 0) return false;
    }

    // Advanced filters
    if (!m_filterAccount.isEmpty() && account != m_filterAccount && toAccount != m_filterAccount) return false;
    if (!m_filterCategory.isEmpty() && category.compare(m_filterCategory, Qt::CaseInsensitive) != 0) return false;

    const double absAmt = std::abs(amount);
    if (!m_minAmount.isEmpty()) {
        bool ok = false;
        const double minVal = m_minAmount.toDouble(&ok);
        if (ok && absAmt < minVal) return false;
    }
    if (!m_maxAmount.isEmpty()) {
        bool ok = false;
        const double maxVal = m_maxAmount.toDouble(&ok);
        if (ok && absAmt > maxVal) return false;
    }

    if (m_datePreset != QStringLiteral("all")) {
        const QDate txDate = QDate::fromString(dateStr, Qt::ISODate);
        const QDate today = QDate::currentDate();
        if (txDate.isValid()) {
            if (m_datePreset == QStringLiteral("this_month")) {
                if (txDate.year() != today.year() || txDate.month() != today.month()) return false;
            } else if (m_datePreset == QStringLiteral("last_month")) {
                const QDate lastMonth = today.addMonths(-1);
                if (txDate.year() != lastMonth.year() || txDate.month() != lastMonth.month()) return false;
            } else if (m_datePreset == QStringLiteral("last_30_days")) {
                if (txDate < today.addDays(-30)) return false;
            } else if (m_datePreset == QStringLiteral("this_year")) {
                if (txDate.year() != today.year()) return false;
            } else if (m_datePreset == QStringLiteral("custom")) {
                if (!m_customStartDate.isEmpty() && dateStr < m_customStartDate) return false;
                if (!m_customEndDate.isEmpty() && dateStr > m_customEndDate) return false;
            }
        }
    }

    // Search query
    const QString q = m_searchQuery.trimmed().toLower();
    if (!q.isEmpty()) {
        const bool match = payee.toLower().contains(q)
            || category.toLower().contains(q)
            || account.toLower().contains(q)
            || toAccount.toLower().contains(q)
            || notes.toLower().contains(q);
        if (!match) return false;
    }

    return true;
}

bool TransactionFilterProxyModel::lessThan(const QModelIndex &left, const QModelIndex &right) const
{
    if (m_sortField == QStringLiteral("amount")) {
        return left.data(TransactionModel::AmountRole).toDouble() < right.data(TransactionModel::AmountRole).toDouble();
    }
    if (m_sortField == QStringLiteral("payee")) {
        return left.data(TransactionModel::PayeeRole).toString().compare(right.data(TransactionModel::PayeeRole).toString(), Qt::CaseInsensitive) < 0;
    }
    if (m_sortField == QStringLiteral("category")) {
        return left.data(TransactionModel::CategoryRole).toString().compare(right.data(TransactionModel::CategoryRole).toString(), Qt::CaseInsensitive) < 0;
    }
    if (m_sortField == QStringLiteral("status")) {
        return left.data(TransactionModel::StatusRole).toString() < right.data(TransactionModel::StatusRole).toString();
    }
    return left.data(TransactionModel::DateRole).toString() < right.data(TransactionModel::DateRole).toString();
}

} // namespace Finly
