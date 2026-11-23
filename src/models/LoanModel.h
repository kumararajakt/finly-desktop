#pragma once

#include "../core/DatabaseManager.h"
#include "../core/Types.h"
#include "TransactionModel.h"

#include <QAbstractListModel>
#include <QVariantList>

namespace Finly {

class LoanModel : public QAbstractListModel
{
    Q_OBJECT

    Q_PROPERTY(int count READ rowCount NOTIFY loansChanged)
    Q_PROPERTY(double totalLentOutstanding READ totalLentOutstanding NOTIFY loansChanged)
    Q_PROPERTY(double totalBorrowedOutstanding READ totalBorrowedOutstanding NOTIFY loansChanged)
    Q_PROPERTY(double netBalance READ netBalance NOTIFY loansChanged)
    Q_PROPERTY(int activeCount READ activeCount NOTIFY loansChanged)
    Q_PROPERTY(int settledCount READ settledCount NOTIFY loansChanged)

public:
    enum Roles {
        IdRole = Qt::UserRole + 1,
        ContactNameRole,
        TypeRole,
        InitialAmountRole,
        RemainingAmountRole,
        AccountRole,
        StartDateRole,
        DueDateRole,
        NotesRole,
        StatusRole
    };

    explicit LoanModel(DatabaseManager *db, TransactionModel *txModel, QObject *parent = nullptr);

    int rowCount(const QModelIndex &parent = QModelIndex()) const override;
    QVariant data(const QModelIndex &index, int role = Qt::DisplayRole) const override;
    QHash<int, QByteArray> roleNames() const override;

    double totalLentOutstanding() const;
    double totalBorrowedOutstanding() const;
    double netBalance() const;
    int activeCount() const;
    int settledCount() const;

    Q_INVOKABLE void load();
    Q_INVOKABLE void addLoan(const QString &contactName, const QString &type, double amount,
                             const QString &account, const QString &startDate,
                             const QString &dueDate, const QString &notes);
    Q_INVOKABLE void recordPayment(const QString &loanId, double amount, const QString &account,
                                   const QString &date, const QString &notes);
    Q_INVOKABLE void deleteLoan(const QString &id);
    Q_INVOKABLE QVariantList paymentsForLoan(const QString &loanId) const;
    Q_INVOKABLE QStringList knownContacts() const;

Q_SIGNALS:
    void loansChanged();

private:
    void saveLoans();
    void savePayments();

    DatabaseManager *m_db = nullptr;
    TransactionModel *m_txModel = nullptr;
    QVector<LoanRecord> m_loans;
    QVector<LoanPayment> m_payments;
};

} // namespace Finly
