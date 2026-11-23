#include "CategoryModel.h"

#include <QJsonArray>
#include <QJsonDocument>
#include <QJsonObject>
#include <QUuid>
#include <cmath>

namespace Finly {

QVector<CategoryItem> CategoryModel::defaultCategories()
{
    return {
        {QStringLiteral("cat-housing"), QStringLiteral("Housing"), QStringLiteral("#2563eb"), QStringLiteral("expense"), {}, QStringLiteral("Rent, mortgage, and home maintenance"), true},
        {QStringLiteral("cat-groceries"), QStringLiteral("Groceries"), QStringLiteral("#10b981"), QStringLiteral("expense"), {}, QStringLiteral("Food, household essentials, supermarkets"), true},
        {QStringLiteral("cat-dining"), QStringLiteral("Dining Out"), QStringLiteral("#f59e0b"), QStringLiteral("expense"), {}, QStringLiteral("Restaurants, cafes, food delivery"), true},
        {QStringLiteral("cat-transport"), QStringLiteral("Transportation"), QStringLiteral("#8b5cf6"), QStringLiteral("expense"), {}, QStringLiteral("Gas, transit, flights, rideshare"), true},
        {QStringLiteral("cat-utilities"), QStringLiteral("Utilities"), QStringLiteral("#06b6d4"), QStringLiteral("expense"), {}, QStringLiteral("Electricity, water, internet, phone"), true},
        {QStringLiteral("cat-salary"), QStringLiteral("Salary"), QStringLiteral("#10b981"), QStringLiteral("income"), {}, QStringLiteral("Employment income, payroll, wages"), true},
        {QStringLiteral("cat-entertainment"), QStringLiteral("Entertainment"), QStringLiteral("#ec4899"), QStringLiteral("expense"), {}, QStringLiteral("Movies, games, streaming services"), true},
        {QStringLiteral("cat-healthcare"), QStringLiteral("Healthcare"), QStringLiteral("#ef4444"), QStringLiteral("expense"), {}, QStringLiteral("Doctor visits, prescriptions, medical care"), true},
        {QStringLiteral("cat-shopping"), QStringLiteral("Shopping"), QStringLiteral("#f97316"), QStringLiteral("expense"), {}, QStringLiteral("Clothing, gadgets, retail purchases"), true},
        {QStringLiteral("cat-travel"), QStringLiteral("Travel"), QStringLiteral("#14b8a6"), QStringLiteral("expense"), {}, QStringLiteral("Hotels, vacations, travel bookings"), true},
        {QStringLiteral("cat-education"), QStringLiteral("Education"), QStringLiteral("#6366f1"), QStringLiteral("expense"), {}, QStringLiteral("Tuition, courses, books, learning"), true},
        {QStringLiteral("cat-investment"), QStringLiteral("Investments"), QStringLiteral("#0ea5e9"), QStringLiteral("both"), {}, QStringLiteral("Dividends, returns, capital gains"), true},
        {QStringLiteral("cat-other"), QStringLiteral("Other"), QStringLiteral("#64748b"), QStringLiteral("both"), {}, QStringLiteral("Miscellaneous expenses and income"), true},
    };
}

CategoryModel::CategoryModel(DatabaseManager *db, TransactionModel *txModel, QObject *parent)
    : QAbstractListModel(parent)
    , m_db(db)
    , m_txModel(txModel)
{
    if (m_txModel) {
        connect(m_txModel, &TransactionModel::transactionsChanged, this, [this]() {
            if (!m_categories.isEmpty()) {
                Q_EMIT dataChanged(index(0), index(m_categories.size() - 1));
            }
            Q_EMIT categoriesChanged();
        });
    }
}

int CategoryModel::rowCount(const QModelIndex &parent) const
{
    if (parent.isValid()) {
        return 0;
    }
    return m_categories.size();
}

QVariant CategoryModel::data(const QModelIndex &index, int role) const
{
    if (!index.isValid() || index.row() < 0 || index.row() >= m_categories.size()) {
        return {};
    }
    const CategoryItem &cat = m_categories.at(index.row());

    auto computeStats = [&]() -> std::tuple<int, double, double> {
        if (!m_txModel) {
            return {0, 0.0, 0.0};
        }
        int cnt = 0;
        double spend = 0.0;
        double income = 0.0;
        const QString norm = cat.name.trimmed().toLower();
        for (const auto &tx : m_txModel->items()) {
            if (tx.category.trimmed().toLower() == norm) {
                ++cnt;
                if (tx.amount < 0.0) {
                    spend += std::abs(tx.amount);
                } else if (tx.amount > 0.0 && tx.type != QStringLiteral("transfer")) {
                    income += tx.amount;
                }
            }
        }
        return {cnt, spend, income};
    };

    switch (role) {
    case IdRole:
        return cat.id;
    case NameRole:
        return cat.name;
    case ColorRole:
        return cat.color;
    case TypeRole:
        return cat.type;
    case IconRole:
        return cat.icon;
    case DescriptionRole:
        return cat.description;
    case IsDefaultRole:
        return cat.isDefault;
    case TxCountRole:
        return std::get<0>(computeStats());
    case TotalSpendRole:
        return std::get<1>(computeStats());
    case TotalIncomeRole:
        return std::get<2>(computeStats());
    default:
        return {};
    }
}

QHash<int, QByteArray> CategoryModel::roleNames() const
{
    return {
        {IdRole, "categoryId"},
        {NameRole, "name"},
        {ColorRole, "color"},
        {TypeRole, "categoryType"},
        {IconRole, "icon"},
        {DescriptionRole, "description"},
        {IsDefaultRole, "isDefault"},
        {TxCountRole, "txCount"},
        {TotalSpendRole, "totalSpend"},
        {TotalIncomeRole, "totalIncome"},
    };
}

int CategoryModel::expenseCategoriesCount() const
{
    int count = 0;
    for (const auto &c : m_categories) {
        if (c.type == QStringLiteral("expense") || c.type == QStringLiteral("both")) ++count;
    }
    return count;
}

int CategoryModel::incomeCategoriesCount() const
{
    int count = 0;
    for (const auto &c : m_categories) {
        if (c.type == QStringLiteral("income") || c.type == QStringLiteral("both")) ++count;
    }
    return count;
}

void CategoryModel::load()
{
    if (!m_db) {
        return;
    }
    beginResetModel();
    m_categories.clear();
    if (const auto json = m_db->getSetting(QStringLiteral("user_categories"))) {
        const QJsonArray arr = QJsonDocument::fromJson(json->toUtf8()).array();
        for (const QJsonValue &val : arr) {
            const QJsonObject obj = val.toObject();
            CategoryItem c;
            c.id = obj.value(QStringLiteral("id")).toString();
            c.name = obj.value(QStringLiteral("name")).toString();
            c.color = obj.value(QStringLiteral("color")).toString(QStringLiteral("#64748b"));
            c.type = obj.value(QStringLiteral("type")).toString(QStringLiteral("expense"));
            c.icon = obj.value(QStringLiteral("icon")).toString();
            c.description = obj.value(QStringLiteral("description")).toString();
            c.isDefault = obj.value(QStringLiteral("isDefault")).toBool(false);
            m_categories.append(c);
        }
    }
    if (m_categories.isEmpty()) {
        m_categories = defaultCategories();
        save();
    }
    endResetModel();
    Q_EMIT categoriesChanged();
}

void CategoryModel::save()
{
    if (!m_db) {
        return;
    }
    QJsonArray arr;
    for (const auto &c : m_categories) {
        arr.append(QJsonObject{
            {QStringLiteral("id"), c.id},
            {QStringLiteral("name"), c.name},
            {QStringLiteral("color"), c.color},
            {QStringLiteral("type"), c.type},
            {QStringLiteral("icon"), c.icon},
            {QStringLiteral("description"), c.description},
            {QStringLiteral("isDefault"), c.isDefault},
        });
    }
    m_db->setSetting(QStringLiteral("user_categories"), QString::fromUtf8(QJsonDocument(arr).toJson(QJsonDocument::Compact)));
}

void CategoryModel::addCategory(const QString &name, const QString &type, const QString &color, const QString &description)
{
    beginInsertRows(QModelIndex(), m_categories.size(), m_categories.size());
    CategoryItem c;
    c.id = QStringLiteral("cat-") + QUuid::createUuid().toString(QUuid::Id128).left(12);
    c.name = name.trimmed();
    c.type = type;
    c.color = color.isEmpty() ? QStringLiteral("#5842e3") : color;
    c.description = description.trimmed();
    c.isDefault = false;
    m_categories.append(c);
    endInsertRows();
    save();
    Q_EMIT categoriesChanged();
}

void CategoryModel::updateCategory(const QString &id, const QString &name, const QString &type, const QString &color, const QString &description)
{
    for (int i = 0; i < m_categories.size(); ++i) {
        if (m_categories[i].id == id) {
            m_categories[i].name = name.trimmed();
            m_categories[i].type = type;
            m_categories[i].color = color;
            m_categories[i].description = description.trimmed();
            Q_EMIT dataChanged(index(i), index(i));
            save();
            Q_EMIT categoriesChanged();
            return;
        }
    }
}

void CategoryModel::deleteCategory(const QString &id, const QString &reassignToName)
{
    for (int i = 0; i < m_categories.size(); ++i) {
        if (m_categories[i].id == id) {
            const QString oldName = m_categories[i].name;
            if (!reassignToName.isEmpty() && m_db) {
                m_db->reassignCategoryTransactions(oldName, reassignToName, colorForCategory(reassignToName));
                if (m_txModel) {
                    m_txModel->refresh();
                }
            }
            beginRemoveRows(QModelIndex(), i, i);
            m_categories.removeAt(i);
            endRemoveRows();
            save();
            Q_EMIT categoriesChanged();
            return;
        }
    }
}

QString CategoryModel::colorForCategory(const QString &name) const
{
    const QString norm = name.trimmed().toLower();
    for (const auto &c : m_categories) {
        if (c.name.trimmed().toLower() == norm) {
            return c.color;
        }
    }
    return QStringLiteral("#64748b");
}

QStringList CategoryModel::categoryNames() const
{
    QStringList names;
    names.reserve(m_categories.size());
    for (const auto &c : m_categories) {
        names.append(c.name);
    }
    return names;
}

} // namespace Finly
