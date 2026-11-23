#pragma once

#include "../core/DatabaseManager.h"
#include "../core/Types.h"
#include "TransactionModel.h"

#include <QAbstractListModel>

namespace Finly {

class BudgetModel : public QAbstractListModel
{
    Q_OBJECT

    Q_PROPERTY(int count READ rowCount NOTIFY budgetsChanged)
    Q_PROPERTY(double totalBudget READ totalBudget NOTIFY budgetsChanged)
    Q_PROPERTY(double totalSpent READ totalSpent NOTIFY budgetsChanged)
    Q_PROPERTY(double totalRemaining READ totalRemaining NOTIFY budgetsChanged)
    Q_PROPERTY(int overallPercentage READ overallPercentage NOTIFY budgetsChanged)
    Q_PROPERTY(int healthyCount READ healthyCount NOTIFY budgetsChanged)
    Q_PROPERTY(int warningCount READ warningCount NOTIFY budgetsChanged)
    Q_PROPERTY(int overCount READ overCount NOTIFY budgetsChanged)

public:
    enum Roles {
        IdRole = Qt::UserRole + 1,
        CategoryRole,
        LimitRole,
        PeriodRole,
        ColorRole,
        SpentRole,
        RemainingRole,
        PercentageRole,
        StatusRole
    };

    explicit BudgetModel(DatabaseManager *db, TransactionModel *txModel, QObject *parent = nullptr);

    int rowCount(const QModelIndex &parent = QModelIndex()) const override;
    QVariant data(const QModelIndex &index, int role = Qt::DisplayRole) const override;
    QHash<int, QByteArray> roleNames() const override;

    double totalBudget() const;
    double totalSpent() const;
    double totalRemaining() const;
    int overallPercentage() const;
    int healthyCount() const;
    int warningCount() const;
    int overCount() const;

    Q_INVOKABLE void load();
    Q_INVOKABLE void addBudget(const QString &category, double limit, const QString &color, const QString &period = QStringLiteral("monthly"));
    Q_INVOKABLE void updateBudget(const QString &id, const QString &category, double limit, const QString &color, const QString &period = QStringLiteral("monthly"));
    Q_INVOKABLE void deleteBudget(const QString &id);

Q_SIGNALS:
    void budgetsChanged();

private:
    void save();
    QString computeStatus(double spent, double limit) const;

    DatabaseManager *m_db = nullptr;
    TransactionModel *m_txModel = nullptr;
    QVector<BudgetItem> m_budgets;
};

} // namespace Finly
