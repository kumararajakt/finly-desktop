#include "BudgetModel.h"

#include <QJsonArray>
#include <QJsonDocument>
#include <QJsonObject>
#include <QUuid>
#include <algorithm>
#include <cmath>

namespace Finly {

BudgetModel::BudgetModel(DatabaseManager *db, TransactionModel *txModel, QObject *parent)
    : QAbstractListModel(parent)
    , m_db(db)
    , m_txModel(txModel)
{
    if (m_txModel) {
        connect(m_txModel, &TransactionModel::transactionsChanged, this, [this]() {
            if (!m_budgets.isEmpty()) {
                Q_EMIT dataChanged(index(0), index(m_budgets.size() - 1));
            }
            Q_EMIT budgetsChanged();
        });
    }
}

int BudgetModel::rowCount(const QModelIndex &parent) const
{
    if (parent.isValid()) {
        return 0;
    }
    return m_budgets.size();
}

QString BudgetModel::computeStatus(double spent, double limit) const
{
    const double pct = limit > 0.0 ? (spent / limit) * 100.0 : 0.0;
    if (pct > 100.0) {
        return QStringLiteral("over");
    }
    if (pct >= 80.0) {
        return QStringLiteral("warning");
    }
    return QStringLiteral("healthy");
}

QVariant BudgetModel::data(const QModelIndex &index, int role) const
{
    if (!index.isValid() || index.row() < 0 || index.row() >= m_budgets.size()) {
        return {};
    }
    const BudgetItem &b = m_budgets.at(index.row());
    const double spent = m_txModel ? m_txModel->spentForCategory(b.category) : 0.0;
    const double remaining = b.limit - spent;
    const int pct = b.limit > 0.0 ? qRound((spent / b.limit) * 100.0) : 0;

    switch (role) {
    case IdRole:
        return b.id;
    case CategoryRole:
        return b.category;
    case LimitRole:
        return b.limit;
    case PeriodRole:
        return b.period;
    case ColorRole:
        return b.color;
    case SpentRole:
        return spent;
    case RemainingRole:
        return remaining;
    case PercentageRole:
        return pct;
    case StatusRole:
        return computeStatus(spent, b.limit);
    default:
        return {};
    }
}

QHash<int, QByteArray> BudgetModel::roleNames() const
{
    return {
        {IdRole, "budgetId"},
        {CategoryRole, "category"},
        {LimitRole, "limit"},
        {PeriodRole, "period"},
        {ColorRole, "color"},
        {SpentRole, "spent"},
        {RemainingRole, "remaining"},
        {PercentageRole, "percentage"},
        {StatusRole, "status"},
    };
}

double BudgetModel::totalBudget() const
{
    double sum = 0.0;
    for (const auto &b : m_budgets) {
        sum += b.limit;
    }
    return sum;
}

double BudgetModel::totalSpent() const
{
    if (!m_txModel) {
        return 0.0;
    }
    double sum = 0.0;
    for (const auto &b : m_budgets) {
        sum += m_txModel->spentForCategory(b.category);
    }
    return sum;
}

double BudgetModel::totalRemaining() const
{
    return totalBudget() - totalSpent();
}

int BudgetModel::overallPercentage() const
{
    const double total = totalBudget();
    if (total <= 0.0) {
        return 0;
    }
    return std::min(100, static_cast<int>(qRound((totalSpent() / total) * 100.0)));
}

int BudgetModel::healthyCount() const
{
    int count = 0;
    for (const auto &b : m_budgets) {
        const double spent = m_txModel ? m_txModel->spentForCategory(b.category) : 0.0;
        if (computeStatus(spent, b.limit) == QStringLiteral("healthy")) ++count;
    }
    return count;
}

int BudgetModel::warningCount() const
{
    int count = 0;
    for (const auto &b : m_budgets) {
        const double spent = m_txModel ? m_txModel->spentForCategory(b.category) : 0.0;
        if (computeStatus(spent, b.limit) == QStringLiteral("warning")) ++count;
    }
    return count;
}

int BudgetModel::overCount() const
{
    int count = 0;
    for (const auto &b : m_budgets) {
        const double spent = m_txModel ? m_txModel->spentForCategory(b.category) : 0.0;
        if (computeStatus(spent, b.limit) == QStringLiteral("over")) ++count;
    }
    return count;
}

void BudgetModel::load()
{
    if (!m_db) {
        return;
    }
    beginResetModel();
    m_budgets.clear();
    if (const auto json = m_db->getSetting(QStringLiteral("user_budgets"))) {
        const QJsonArray arr = QJsonDocument::fromJson(json->toUtf8()).array();
        for (const QJsonValue &val : arr) {
            const QJsonObject obj = val.toObject();
            BudgetItem b;
            b.id = obj.value(QStringLiteral("id")).toString();
            b.category = obj.value(QStringLiteral("category")).toString();
            b.limit = obj.value(QStringLiteral("limit")).toDouble();
            b.period = obj.value(QStringLiteral("period")).toString(QStringLiteral("monthly"));
            b.color = obj.value(QStringLiteral("color")).toString(QStringLiteral("#5842e3"));
            m_budgets.append(b);
        }
    }
    endResetModel();
    Q_EMIT budgetsChanged();
}

void BudgetModel::save()
{
    if (!m_db) {
        return;
    }
    QJsonArray arr;
    for (const auto &b : m_budgets) {
        arr.append(QJsonObject{
            {QStringLiteral("id"), b.id},
            {QStringLiteral("category"), b.category},
            {QStringLiteral("limit"), b.limit},
            {QStringLiteral("period"), b.period},
            {QStringLiteral("color"), b.color},
        });
    }
    m_db->setSetting(QStringLiteral("user_budgets"), QString::fromUtf8(QJsonDocument(arr).toJson(QJsonDocument::Compact)));
}

void BudgetModel::addBudget(const QString &category, double limit, const QString &color, const QString &period)
{
    beginInsertRows(QModelIndex(), m_budgets.size(), m_budgets.size());
    BudgetItem b;
    b.id = QStringLiteral("bgt-") + QUuid::createUuid().toString(QUuid::Id128).left(12);
    b.category = category.trimmed();
    b.limit = limit;
    b.color = color.isEmpty() ? QStringLiteral("#5842e3") : color;
    b.period = period;
    m_budgets.append(b);
    endInsertRows();
    save();
    Q_EMIT budgetsChanged();
}

void BudgetModel::updateBudget(const QString &id, const QString &category, double limit, const QString &color, const QString &period)
{
    for (int i = 0; i < m_budgets.size(); ++i) {
        if (m_budgets[i].id == id) {
            m_budgets[i].category = category.trimmed();
            m_budgets[i].limit = limit;
            m_budgets[i].color = color;
            m_budgets[i].period = period;
            Q_EMIT dataChanged(index(i), index(i));
            save();
            Q_EMIT budgetsChanged();
            return;
        }
    }
}

void BudgetModel::deleteBudget(const QString &id)
{
    for (int i = 0; i < m_budgets.size(); ++i) {
        if (m_budgets[i].id == id) {
            beginRemoveRows(QModelIndex(), i, i);
            m_budgets.removeAt(i);
            endRemoveRows();
            save();
            Q_EMIT budgetsChanged();
            return;
        }
    }
}

} // namespace Finly
