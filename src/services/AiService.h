#pragma once

#include "../core/SettingsManager.h"
#include "../models/AccountModel.h"
#include "../models/BudgetModel.h"
#include "../models/CategoryModel.h"
#include "../models/LoanModel.h"
#include "../models/TransactionModel.h"
#include "NotificationService.h"

#include <QNetworkAccessManager>
#include <QObject>
#include <QVariantList>
#include <QVariantMap>

namespace Finly {

class AiService : public QObject
{
    Q_OBJECT

    Q_PROPERTY(bool busy READ busy NOTIFY busyChanged)

public:
    explicit AiService(SettingsManager *settings,
                       AccountModel *accounts,
                       TransactionModel *transactions,
                       BudgetModel *budgets,
                       CategoryModel *categories,
                       LoanModel *loans,
                       NotificationService *notifications,
                       QObject *parent = nullptr);

    bool busy() const;

    Q_INVOKABLE void testConnection(const QVariantMap &configMap);
    Q_INVOKABLE void detectOllamaModels(const QString &endpoint);
    Q_INVOKABLE void sendChatMessage(const QString &prompt, const QVariantList &history, const QVariantList &attachedTransactions = {});
    Q_INVOKABLE void parseNaturalLanguageTransaction(const QString &text);
    Q_INVOKABLE void generateHealthDigest();
    Q_INVOKABLE void smartCategorizeBatch(const QVariantList &rows);

Q_SIGNALS:
    void busyChanged();
    void testConnectionFinished(bool success, const QString &message, const QStringList &models);
    void ollamaModelsDetected(const QStringList &models, const QString &error);
    void chatResponseReceived(const QString &reply, const QString &error);
    void transactionParsed(const QVariantMap &txData, const QString &error);
    void digestGenerated(const QString &summary, const QString &error);
    void batchCategorized(const QVariantMap &categoryById, const QString &error);

private:
    using Callback = std::function<void(const QString &reply, const QString &error)>;

    void sendPrompt(const AIConfig &cfg, const QString &systemPrompt, const QVariantList &messages, Callback cb);
    QString buildFinancialContext() const;
    void setBusy(bool b);

    QNetworkAccessManager *m_nam = nullptr;
    SettingsManager *m_settings = nullptr;
    AccountModel *m_accounts = nullptr;
    TransactionModel *m_transactions = nullptr;
    BudgetModel *m_budgets = nullptr;
    CategoryModel *m_categories = nullptr;
    LoanModel *m_loans = nullptr;
    NotificationService *m_notifications = nullptr;
    bool m_busy = false;
};

} // namespace Finly
