#pragma once

#include "../core/DatabaseManager.h"
#include "../core/Types.h"
#include "AccountModel.h"

#include <QAbstractListModel>
#include <QSortFilterProxyModel>
#include <QVariantList>
#include <QVariantMap>

namespace Finly {

class TransactionModel : public QAbstractListModel
{
    Q_OBJECT

    Q_PROPERTY(int count READ rowCount NOTIFY transactionsChanged)
    Q_PROPERTY(double totalInflow READ totalInflow NOTIFY transactionsChanged)
    Q_PROPERTY(double totalOutflow READ totalOutflow NOTIFY transactionsChanged)
    Q_PROPERTY(double netCashFlow READ netCashFlow NOTIFY transactionsChanged)
    Q_PROPERTY(double savingsRate READ savingsRate NOTIFY transactionsChanged)
    Q_PROPERTY(int pendingCount READ pendingCount NOTIFY transactionsChanged)
    Q_PROPERTY(int flaggedCount READ flaggedCount NOTIFY transactionsChanged)

public:
    enum Roles {
        IdRole = Qt::UserRole + 1,
        DateRole,
        PayeeRole,
        CategoryRole,
        CategoryColorRole,
        AccountRole,
        ToAccountRole,
        AmountRole,
        TypeRole,
        StatusRole,
        NotesRole
    };

    explicit TransactionModel(DatabaseManager *db, AccountModel *accountModel, QObject *parent = nullptr);

    int rowCount(const QModelIndex &parent = QModelIndex()) const override;
    QVariant data(const QModelIndex &index, int role = Qt::DisplayRole) const override;
    QHash<int, QByteArray> roleNames() const override;

    const QVector<Transaction> &items() const;

    double totalInflow() const;
    double totalOutflow() const;
    double netCashFlow() const;
    double savingsRate() const;
    int pendingCount() const;
    int flaggedCount() const;

    Q_INVOKABLE void refresh();
    Q_INVOKABLE bool addTransaction(const QVariantMap &txMap);
    Q_INVOKABLE bool updateTransaction(const QVariantMap &txMap);
    Q_INVOKABLE bool deleteTransaction(const QString &id);
    Q_INVOKABLE QString toggleFlagTransaction(const QString &id);
    Q_INVOKABLE int importTransactions(const QVariantList &txList);
    Q_INVOKABLE QVariantList categoryBreakdown() const;
    Q_INVOKABLE double spentForCategory(const QString &category) const;

Q_SIGNALS:
    void transactionsChanged();

private:
    static Transaction mapToTransaction(const QVariantMap &m);

    DatabaseManager *m_db = nullptr;
    AccountModel *m_accountModel = nullptr;
    QVector<Transaction> m_transactions;
};

class TransactionFilterProxyModel : public QSortFilterProxyModel
{
    Q_OBJECT

    Q_PROPERTY(QString searchQuery READ searchQuery WRITE setSearchQuery NOTIFY filterChanged)
    Q_PROPERTY(QString activeFilter READ activeFilter WRITE setActiveFilter NOTIFY filterChanged)
    Q_PROPERTY(QString filterAccount READ filterAccount WRITE setFilterAccount NOTIFY filterChanged)
    Q_PROPERTY(QString filterCategory READ filterCategory WRITE setFilterCategory NOTIFY filterChanged)
    Q_PROPERTY(QString datePreset READ datePreset WRITE setDatePreset NOTIFY filterChanged)
    Q_PROPERTY(QString customStartDate READ customStartDate WRITE setCustomStartDate NOTIFY filterChanged)
    Q_PROPERTY(QString customEndDate READ customEndDate WRITE setCustomEndDate NOTIFY filterChanged)
    Q_PROPERTY(QString minAmount READ minAmount WRITE setMinAmount NOTIFY filterChanged)
    Q_PROPERTY(QString maxAmount READ maxAmount WRITE setMaxAmount NOTIFY filterChanged)
    Q_PROPERTY(int activeFiltersCount READ activeFiltersCount NOTIFY filterChanged)
    Q_PROPERTY(int filteredCount READ rowCount NOTIFY filterChanged)

public:
    explicit TransactionFilterProxyModel(QObject *parent = nullptr);

    QString searchQuery() const;
    void setSearchQuery(const QString &q);

    QString activeFilter() const;
    void setActiveFilter(const QString &f);

    QString filterAccount() const;
    void setFilterAccount(const QString &acc);

    QString filterCategory() const;
    void setFilterCategory(const QString &cat);

    QString datePreset() const;
    void setDatePreset(const QString &preset);

    QString customStartDate() const;
    void setCustomStartDate(const QString &d);

    QString customEndDate() const;
    void setCustomEndDate(const QString &d);

    QString minAmount() const;
    void setMinAmount(const QString &v);

    QString maxAmount() const;
    void setMaxAmount(const QString &v);

    int activeFiltersCount() const;

    Q_INVOKABLE void clearAllFilters();
    Q_INVOKABLE void sortByField(const QString &field, bool ascending);

Q_SIGNALS:
    void filterChanged();

protected:
    bool filterAcceptsRow(int sourceRow, const QModelIndex &sourceParent) const override;
    bool lessThan(const QModelIndex &left, const QModelIndex &right) const override;

private:
    QString m_searchQuery;
    QString m_activeFilter = QStringLiteral("all");
    QString m_filterAccount;
    QString m_filterCategory;
    QString m_datePreset = QStringLiteral("all");
    QString m_customStartDate;
    QString m_customEndDate;
    QString m_minAmount;
    QString m_maxAmount;
    QString m_sortField = QStringLiteral("date");
};

} // namespace Finly
