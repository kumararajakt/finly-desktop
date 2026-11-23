#pragma once

#include "../core/DatabaseManager.h"
#include "../core/Types.h"

#include <QAbstractListModel>

namespace Finly {

class AccountModel : public QAbstractListModel
{
    Q_OBJECT

    Q_PROPERTY(int count READ rowCount NOTIFY accountsChanged)
    Q_PROPERTY(double totalNetWorth READ totalNetWorth NOTIFY accountsChanged)
    Q_PROPERTY(double totalAssets READ totalAssets NOTIFY accountsChanged)
    Q_PROPERTY(double totalLiabilities READ totalLiabilities NOTIFY accountsChanged)

public:
    enum Roles {
        IdRole = Qt::UserRole + 1,
        NameRole,
        TypeRole,
        BalanceRole
    };

    explicit AccountModel(DatabaseManager *db, QObject *parent = nullptr);

    int rowCount(const QModelIndex &parent = QModelIndex()) const override;
    QVariant data(const QModelIndex &index, int role = Qt::DisplayRole) const override;
    QHash<int, QByteArray> roleNames() const override;

    double totalNetWorth() const;
    double totalAssets() const;
    double totalLiabilities() const;

    Q_INVOKABLE void refresh();
    Q_INVOKABLE bool addAccount(const QString &name, const QString &type, double balance);
    Q_INVOKABLE bool deleteAccount(const QString &idOrName);
    Q_INVOKABLE QStringList accountNames() const;

Q_SIGNALS:
    void accountsChanged();

private:
    DatabaseManager *m_db = nullptr;
    QVector<Account> m_accounts;
};

} // namespace Finly
