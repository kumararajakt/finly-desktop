#pragma once

#include "../core/DatabaseManager.h"
#include "../core/Types.h"
#include "TransactionModel.h"

#include <QAbstractListModel>

namespace Finly {

class CategoryModel : public QAbstractListModel
{
    Q_OBJECT

    Q_PROPERTY(int count READ rowCount NOTIFY categoriesChanged)
    Q_PROPERTY(int expenseCategoriesCount READ expenseCategoriesCount NOTIFY categoriesChanged)
    Q_PROPERTY(int incomeCategoriesCount READ incomeCategoriesCount NOTIFY categoriesChanged)

public:
    enum Roles {
        IdRole = Qt::UserRole + 1,
        NameRole,
        ColorRole,
        TypeRole,
        IconRole,
        DescriptionRole,
        IsDefaultRole,
        TxCountRole,
        TotalSpendRole,
        TotalIncomeRole
    };

    explicit CategoryModel(DatabaseManager *db, TransactionModel *txModel, QObject *parent = nullptr);

    int rowCount(const QModelIndex &parent = QModelIndex()) const override;
    QVariant data(const QModelIndex &index, int role = Qt::DisplayRole) const override;
    QHash<int, QByteArray> roleNames() const override;

    int expenseCategoriesCount() const;
    int incomeCategoriesCount() const;

    Q_INVOKABLE void load();
    Q_INVOKABLE void addCategory(const QString &name, const QString &type, const QString &color, const QString &description);
    Q_INVOKABLE void updateCategory(const QString &id, const QString &name, const QString &type, const QString &color, const QString &description);
    Q_INVOKABLE void deleteCategory(const QString &id, const QString &reassignToName = QString());
    Q_INVOKABLE QString colorForCategory(const QString &name) const;
    Q_INVOKABLE QStringList categoryNames() const;

Q_SIGNALS:
    void categoriesChanged();

private:
    void save();
    static QVector<CategoryItem> defaultCategories();

    DatabaseManager *m_db = nullptr;
    TransactionModel *m_txModel = nullptr;
    QVector<CategoryItem> m_categories;
};

} // namespace Finly
