#include "LoanModel.h"

#include <QJsonArray>
#include <QJsonDocument>
#include <QJsonObject>
#include <QSet>
#include <QUuid>
#include <algorithm>

namespace Finly {

LoanModel::LoanModel(DatabaseManager *db, TransactionModel *txModel, QObject *parent)
    : QAbstractListModel(parent)
    , m_db(db)
    , m_txModel(txModel)
{
}

int LoanModel::rowCount(const QModelIndex &parent) const
{
    if (parent.isValid()) {
        return 0;
    }
    return m_loans.size();
}

QVariant LoanModel::data(const QModelIndex &index, int role) const
{
    if (!index.isValid() || index.row() < 0 || index.row() >= m_loans.size()) {
        return {};
    }
    const LoanRecord &l = m_loans.at(index.row());
    switch (role) {
    case IdRole:
        return l.id;
    case ContactNameRole:
        return l.contactName;
    case TypeRole:
        return l.type;
    case InitialAmountRole:
        return l.initialAmount;
    case RemainingAmountRole:
        return l.remainingAmount;
    case AccountRole:
        return l.account;
    case StartDateRole:
        return l.startDate;
    case DueDateRole:
        return l.dueDate;
    case NotesRole:
        return l.notes;
    case StatusRole:
        return l.status;
    default:
        return {};
    }
}

QHash<int, QByteArray> LoanModel::roleNames() const
{
    return {
        {IdRole, "loanId"},
        {ContactNameRole, "contactName"},
        {TypeRole, "loanType"},
        {InitialAmountRole, "initialAmount"},
        {RemainingAmountRole, "remainingAmount"},
        {AccountRole, "account"},
        {StartDateRole, "startDate"},
        {DueDateRole, "dueDate"},
        {NotesRole, "notes"},
        {StatusRole, "status"},
    };
}

double LoanModel::totalLentOutstanding() const
{
    double sum = 0.0;
    for (const auto &l : m_loans) {
        if (l.type == QStringLiteral("lent") && l.status == QStringLiteral("active")) {
            sum += l.remainingAmount;
        }
    }
    return sum;
}

double LoanModel::totalBorrowedOutstanding() const
{
    double sum = 0.0;
    for (const auto &l : m_loans) {
        if (l.type == QStringLiteral("borrowed") && l.status == QStringLiteral("active")) {
            sum += l.remainingAmount;
        }
    }
    return sum;
}

double LoanModel::netBalance() const
{
    return totalLentOutstanding() - totalBorrowedOutstanding();
}

int LoanModel::activeCount() const
{
    int count = 0;
    for (const auto &l : m_loans) {
        if (l.status == QStringLiteral("active")) ++count;
    }
    return count;
}

int LoanModel::settledCount() const
{
    int count = 0;
    for (const auto &l : m_loans) {
        if (l.status == QStringLiteral("settled")) ++count;
    }
    return count;
}

void LoanModel::load()
{
    if (!m_db) {
        return;
    }
    beginResetModel();
    m_loans.clear();
    m_payments.clear();

    if (const auto json = m_db->getSetting(QStringLiteral("user_loans"))) {
        const QJsonArray arr = QJsonDocument::fromJson(json->toUtf8()).array();
        for (const QJsonValue &val : arr) {
            const QJsonObject obj = val.toObject();
            LoanRecord l;
            l.id = obj.value(QStringLiteral("id")).toString();
            l.contactName = obj.value(QStringLiteral("contactName")).toString();
            l.type = obj.value(QStringLiteral("type")).toString(QStringLiteral("lent"));
            l.initialAmount = obj.value(QStringLiteral("initialAmount")).toDouble();
            l.remainingAmount = obj.value(QStringLiteral("remainingAmount")).toDouble();
            l.account = obj.value(QStringLiteral("account")).toString();
            l.startDate = obj.value(QStringLiteral("startDate")).toString();
            l.dueDate = obj.value(QStringLiteral("dueDate")).toString();
            l.notes = obj.value(QStringLiteral("notes")).toString();
            l.status = obj.value(QStringLiteral("status")).toString(QStringLiteral("active"));
            m_loans.append(l);
        }
    }

    if (const auto json = m_db->getSetting(QStringLiteral("user_loan_payments"))) {
        const QJsonArray arr = QJsonDocument::fromJson(json->toUtf8()).array();
        for (const QJsonValue &val : arr) {
            const QJsonObject obj = val.toObject();
            LoanPayment p;
            p.id = obj.value(QStringLiteral("id")).toString();
            p.loanId = obj.value(QStringLiteral("loanId")).toString();
            p.contactName = obj.value(QStringLiteral("contactName")).toString();
            p.date = obj.value(QStringLiteral("date")).toString();
            p.amount = obj.value(QStringLiteral("amount")).toDouble();
            p.account = obj.value(QStringLiteral("account")).toString();
            p.notes = obj.value(QStringLiteral("notes")).toString();
            m_payments.append(p);
        }
    }

    endResetModel();
    Q_EMIT loansChanged();
}

void LoanModel::saveLoans()
{
    if (!m_db) {
        return;
    }
    QJsonArray arr;
    for (const auto &l : m_loans) {
        arr.append(QJsonObject{
            {QStringLiteral("id"), l.id},
            {QStringLiteral("contactName"), l.contactName},
            {QStringLiteral("type"), l.type},
            {QStringLiteral("initialAmount"), l.initialAmount},
            {QStringLiteral("remainingAmount"), l.remainingAmount},
            {QStringLiteral("account"), l.account},
            {QStringLiteral("startDate"), l.startDate},
            {QStringLiteral("dueDate"), l.dueDate},
            {QStringLiteral("notes"), l.notes},
            {QStringLiteral("status"), l.status},
        });
    }
    m_db->setSetting(QStringLiteral("user_loans"), QString::fromUtf8(QJsonDocument(arr).toJson(QJsonDocument::Compact)));
}

void LoanModel::savePayments()
{
    if (!m_db) {
        return;
    }
    QJsonArray arr;
    for (const auto &p : m_payments) {
        arr.append(QJsonObject{
            {QStringLiteral("id"), p.id},
            {QStringLiteral("loanId"), p.loanId},
            {QStringLiteral("contactName"), p.contactName},
            {QStringLiteral("date"), p.date},
            {QStringLiteral("amount"), p.amount},
            {QStringLiteral("account"), p.account},
            {QStringLiteral("notes"), p.notes},
        });
    }
    m_db->setSetting(QStringLiteral("user_loan_payments"), QString::fromUtf8(QJsonDocument(arr).toJson(QJsonDocument::Compact)));
}

void LoanModel::addLoan(const QString &contactName, const QString &type, double amount,
                        const QString &account, const QString &startDate,
                        const QString &dueDate, const QString &notes)
{
    beginInsertRows(QModelIndex(), m_loans.size(), m_loans.size());
    LoanRecord l;
    l.id = QStringLiteral("loan-") + QUuid::createUuid().toString(QUuid::Id128).left(12);
    l.contactName = contactName.trimmed();
    l.type = type;
    l.initialAmount = amount;
    l.remainingAmount = amount;
    l.account = account;
    l.startDate = startDate;
    l.dueDate = dueDate;
    l.notes = notes.trimmed();
    l.status = QStringLiteral("active");
    m_loans.append(l);
    endInsertRows();
    saveLoans();

    if (m_txModel && !account.isEmpty()) {
        const bool isLent = (type == QStringLiteral("lent"));
        m_txModel->addTransaction(QVariantMap{
            {QStringLiteral("date"), startDate},
            {QStringLiteral("payee"), isLent ? QStringLiteral("Loan to %1").arg(l.contactName) : QStringLiteral("Loan from %1").arg(l.contactName)},
            {QStringLiteral("category"), isLent ? QStringLiteral("Loan Given") : QStringLiteral("Loan Received")},
            {QStringLiteral("categoryColor"), isLent ? QStringLiteral("#f59e0b") : QStringLiteral("#10b981")},
            {QStringLiteral("account"), account},
            {QStringLiteral("amount"), isLent ? -amount : amount},
            {QStringLiteral("type"), QStringLiteral("transfer")},
            {QStringLiteral("status"), QStringLiteral("cleared")},
            {QStringLiteral("notes"), notes},
        });
    }

    Q_EMIT loansChanged();
}

void LoanModel::addLoanFromTransaction(const QString &txId, const QString &contactName, const QString &type,
                                       double amount, const QString &account,
                                       const QString &startDate, const QString &notes)
{
    beginInsertRows(QModelIndex(), m_loans.size(), m_loans.size());
    LoanRecord l;
    l.id = QStringLiteral("loan-") + QUuid::createUuid().toString(QUuid::Id128).left(12);
    l.contactName = contactName.trimmed();
    l.type = type;
    l.initialAmount = amount;
    l.remainingAmount = amount;
    l.account = account;
    l.startDate = startDate;
    l.notes = notes.trimmed();
    l.status = QStringLiteral("active");
    m_loans.append(l);
    endInsertRows();
    saveLoans();

    if (m_txModel && !txId.isEmpty()) {
        const bool isLent = (type == QStringLiteral("lent"));
        m_txModel->updateTransaction(QVariantMap{
            {QStringLiteral("id"), txId},
            {QStringLiteral("date"), startDate},
            {QStringLiteral("payee"), isLent ? QStringLiteral("Loan to %1").arg(l.contactName) : QStringLiteral("Loan from %1").arg(l.contactName)},
            {QStringLiteral("category"), isLent ? QStringLiteral("Loan Given") : QStringLiteral("Loan Received")},
            {QStringLiteral("categoryColor"), isLent ? QStringLiteral("#f59e0b") : QStringLiteral("#10b981")},
            {QStringLiteral("account"), account},
            {QStringLiteral("toAccount"), QString()},
            {QStringLiteral("amount"), isLent ? -std::abs(amount) : std::abs(amount)},
            {QStringLiteral("type"), QStringLiteral("transfer")},
            {QStringLiteral("status"), QStringLiteral("cleared")},
            {QStringLiteral("notes"), notes},
        });
    }

    Q_EMIT loansChanged();
}

void LoanModel::recordPayment(const QString &loanId, double amount, const QString &account,
                              const QString &date, const QString &notes)
{
    for (int i = 0; i < m_loans.size(); ++i) {
        if (m_loans[i].id == loanId) {
            LoanPayment p;
            p.id = QStringLiteral("lp-") + QUuid::createUuid().toString(QUuid::Id128).left(12);
            p.loanId = loanId;
            p.contactName = m_loans[i].contactName;
            p.date = date;
            p.amount = amount;
            p.account = account;
            p.notes = notes.trimmed();
            m_payments.prepend(p);
            savePayments();

            m_loans[i].remainingAmount = std::max(0.0, m_loans[i].remainingAmount - amount);
            if (m_loans[i].remainingAmount <= 0.001) {
                m_loans[i].remainingAmount = 0.0;
                m_loans[i].status = QStringLiteral("settled");
            }
            Q_EMIT dataChanged(index(i), index(i));
            saveLoans();

            if (m_txModel && !account.isEmpty()) {
                const bool isLent = (m_loans[i].type == QStringLiteral("lent"));
                m_txModel->addTransaction(QVariantMap{
                    {QStringLiteral("date"), date},
                    {QStringLiteral("payee"), isLent ? QStringLiteral("Repayment from %1").arg(m_loans[i].contactName) : QStringLiteral("Repayment to %1").arg(m_loans[i].contactName)},
                    {QStringLiteral("category"), QStringLiteral("Loan Repayment")},
                    {QStringLiteral("categoryColor"), QStringLiteral("#10b981")},
                    {QStringLiteral("account"), account},
                    {QStringLiteral("amount"), isLent ? amount : -amount},
                    {QStringLiteral("type"), QStringLiteral("transfer")},
                    {QStringLiteral("status"), QStringLiteral("cleared")},
                    {QStringLiteral("notes"), notes},
                });
            }

            Q_EMIT loansChanged();
            return;
        }
    }
}

void LoanModel::deleteLoan(const QString &id)
{
    for (int i = 0; i < m_loans.size(); ++i) {
        if (m_loans[i].id == id) {
            beginRemoveRows(QModelIndex(), i, i);
            m_loans.removeAt(i);
            endRemoveRows();
            saveLoans();
            Q_EMIT loansChanged();
            return;
        }
    }
}

QVariantList LoanModel::paymentsForLoan(const QString &loanId) const
{
    QVariantList list;
    for (const auto &p : m_payments) {
        if (p.loanId == loanId) {
            list.append(QVariantMap{
                {QStringLiteral("id"), p.id},
                {QStringLiteral("date"), p.date},
                {QStringLiteral("amount"), p.amount},
                {QStringLiteral("account"), p.account},
                {QStringLiteral("notes"), p.notes},
            });
        }
    }
    return list;
}

QStringList LoanModel::knownContacts() const
{
    QSet<QString> set;
    for (const auto &l : m_loans) {
        if (!l.contactName.isEmpty()) {
            set.insert(l.contactName);
        }
    }
    return set.values();
}

} // namespace Finly
