#include "AiService.h"

#include <QDate>
#include <QJsonArray>
#include <QJsonDocument>
#include <QJsonObject>
#include <QNetworkReply>
#include <QNetworkRequest>
#include <QUrl>

namespace Finly {

AiService::AiService(SettingsManager *settings,
                     AccountModel *accounts,
                     TransactionModel *transactions,
                     BudgetModel *budgets,
                     CategoryModel *categories,
                     LoanModel *loans,
                     NotificationService *notifications,
                     QObject *parent)
    : QObject(parent)
    , m_nam(new QNetworkAccessManager(this))
    , m_settings(settings)
    , m_accounts(accounts)
    , m_transactions(transactions)
    , m_budgets(budgets)
    , m_categories(categories)
    , m_loans(loans)
    , m_notifications(notifications)
{
}

bool AiService::busy() const
{
    return m_busy;
}

void AiService::setBusy(bool b)
{
    if (m_busy == b) {
        return;
    }
    m_busy = b;
    Q_EMIT busyChanged();
}

QString AiService::buildFinancialContext() const
{
    const QString sym = m_settings ? m_settings->currencySymbol() : QStringLiteral("$");
    QString ctx;
    ctx += QStringLiteral("User: %1 | Currency: %2 (%3) | Today: %4\n")
               .arg(m_settings ? m_settings->userName() : QStringLiteral("User"),
                    m_settings ? m_settings->currencyCode() : QStringLiteral("USD"),
                    sym,
                    QDate::currentDate().toString(Qt::ISODate));

    if (m_accounts) {
        ctx += QStringLiteral("Net Worth: %1%2 | Assets: %1%3 | Liabilities: %1%4\nAccounts:\n")
                   .arg(sym)
                   .arg(m_accounts->totalNetWorth(), 0, 'f', 2)
                   .arg(m_accounts->totalAssets(), 0, 'f', 2)
                   .arg(m_accounts->totalLiabilities(), 0, 'f', 2);
        for (int i = 0; i < m_accounts->rowCount(); ++i) {
            const QModelIndex idx = m_accounts->index(i);
            ctx += QStringLiteral("- %1 (%2): %3%4\n")
                       .arg(idx.data(AccountModel::NameRole).toString(),
                            idx.data(AccountModel::TypeRole).toString(),
                            sym)
                       .arg(idx.data(AccountModel::BalanceRole).toDouble(), 0, 'f', 2);
        }
    }

    if (m_transactions) {
        ctx += QStringLiteral("Inflow: %1%2 | Outflow: %1%3 | Net Cash Flow: %1%4 | Savings Rate: %5%\n")
                   .arg(sym)
                   .arg(m_transactions->totalInflow(), 0, 'f', 2)
                   .arg(m_transactions->totalOutflow(), 0, 'f', 2)
                   .arg(m_transactions->netCashFlow(), 0, 'f', 2)
                   .arg(m_transactions->savingsRate(), 0, 'f', 1);

        const auto &txs = m_transactions->items();
        const int limit = qMin(40, txs.size());
        ctx += QStringLiteral("Recent Transactions (%1 of %2):\n").arg(limit).arg(txs.size());
        for (int i = 0; i < limit; ++i) {
            const auto &t = txs.at(i);
            ctx += QStringLiteral("- %1 | %2 | %3 | %4 | %5%6 | %7\n")
                       .arg(t.date, t.payee, t.category, t.account, sym)
                       .arg(t.amount, 0, 'f', 2)
                       .arg(t.type);
        }
    }

    if (m_budgets && m_budgets->rowCount() > 0) {
        ctx += QStringLiteral("Budgets:\n");
        for (int i = 0; i < m_budgets->rowCount(); ++i) {
            const QModelIndex idx = m_budgets->index(i);
            ctx += QStringLiteral("- %1: spent %2%3 / limit %2%4 (%5%)\n")
                       .arg(idx.data(BudgetModel::CategoryRole).toString(), sym)
                       .arg(idx.data(BudgetModel::SpentRole).toDouble(), 0, 'f', 2)
                       .arg(idx.data(BudgetModel::LimitRole).toDouble(), 0, 'f', 2)
                       .arg(idx.data(BudgetModel::PercentageRole).toInt());
        }
    }

    if (m_loans && m_loans->rowCount() > 0) {
        ctx += QStringLiteral("Loans: Lent Outstanding %1%2 | Borrowed Outstanding %1%3\n")
                   .arg(sym)
                   .arg(m_loans->totalLentOutstanding(), 0, 'f', 2)
                   .arg(m_loans->totalBorrowedOutstanding(), 0, 'f', 2);
    }

    return ctx;
}

void AiService::detectOllamaModels(const QString &endpoint)
{
    QString base = endpoint.trimmed().isEmpty() ? QStringLiteral("http://localhost:11434") : endpoint.trimmed();
    if (base.endsWith(QLatin1Char('/'))) {
        base.chop(1);
    }

    QNetworkRequest req(QUrl(base + QStringLiteral("/api/tags")));
    req.setTransferTimeout(5000);
    QNetworkReply *reply = m_nam->get(req);
    connect(reply, &QNetworkReply::finished, this, [this, reply]() {
        reply->deleteLater();
        if (reply->error() != QNetworkReply::NoError) {
            Q_EMIT ollamaModelsDetected({}, reply->errorString());
            return;
        }
        const QJsonObject obj = QJsonDocument::fromJson(reply->readAll()).object();
        const QJsonArray arr = obj.value(QStringLiteral("models")).toArray();
        QStringList models;
        for (const QJsonValue &v : arr) {
            QString name = v.toObject().value(QStringLiteral("name")).toString();
            if (name.endsWith(QStringLiteral(":latest"))) {
                name.chop(7);
            }
            if (!name.isEmpty()) {
                models.append(name);
            }
        }
        Q_EMIT ollamaModelsDetected(models, QString());
    });
}

void AiService::testConnection(const QVariantMap &configMap)
{
    AIConfig cfg;
    cfg.enabled = true;
    cfg.provider = configMap.value(QStringLiteral("provider"), QStringLiteral("ollama")).toString();
    cfg.ollamaEndpoint = configMap.value(QStringLiteral("ollamaEndpoint"), QStringLiteral("http://localhost:11434")).toString();
    cfg.ollamaModel = configMap.value(QStringLiteral("ollamaModel"), QStringLiteral("llama3.2")).toString();
    cfg.geminiApiKey = configMap.value(QStringLiteral("geminiApiKey")).toString();
    cfg.geminiModel = configMap.value(QStringLiteral("geminiModel"), QStringLiteral("gemini-1.5-flash")).toString();
    cfg.openaiApiKey = configMap.value(QStringLiteral("openaiApiKey")).toString();
    cfg.openaiModel = configMap.value(QStringLiteral("openaiModel"), QStringLiteral("gpt-4o-mini")).toString();
    cfg.anthropicApiKey = configMap.value(QStringLiteral("anthropicApiKey")).toString();
    cfg.anthropicModel = configMap.value(QStringLiteral("anthropicModel"), QStringLiteral("claude-3-5-haiku-20241022")).toString();

    if (cfg.provider == QStringLiteral("ollama")) {
        QString base = cfg.ollamaEndpoint.trimmed();
        if (base.endsWith(QLatin1Char('/'))) base.chop(1);
        QNetworkRequest req(QUrl(base + QStringLiteral("/api/tags")));
        req.setTransferTimeout(5000);
        QNetworkReply *reply = m_nam->get(req);
        connect(reply, &QNetworkReply::finished, this, [this, reply]() {
            reply->deleteLater();
            if (reply->error() != QNetworkReply::NoError) {
                Q_EMIT testConnectionFinished(false, reply->errorString(), {});
                return;
            }
            const QJsonArray arr = QJsonDocument::fromJson(reply->readAll()).object().value(QStringLiteral("models")).toArray();
            QStringList models;
            for (const QJsonValue &v : arr) {
                QString name = v.toObject().value(QStringLiteral("name")).toString();
                if (name.endsWith(QStringLiteral(":latest"))) name.chop(7);
                if (!name.isEmpty()) models.append(name);
            }
            Q_EMIT testConnectionFinished(true, tr("Connected to Ollama! Found %1 model(s).").arg(models.size()), models);
        });
        return;
    }

    const QVariantList msgs = {QVariantMap{{QStringLiteral("role"), QStringLiteral("user")}, {QStringLiteral("content"), QStringLiteral("Reply with 'Connected'.")}}};
    sendPrompt(cfg, QStringLiteral("Respond concisely."), msgs, [this](const QString &replyText, const QString &err) {
        if (!err.isEmpty()) {
            Q_EMIT testConnectionFinished(false, err, {});
        } else {
            Q_EMIT testConnectionFinished(true, tr("Connected! Response: %1").arg(replyText.trimmed()), {});
        }
    });
}

void AiService::sendPrompt(const AIConfig &cfg, const QString &systemPrompt, const QVariantList &messages, Callback cb)
{
    if (cfg.provider == QStringLiteral("ollama")) {
        QString base = cfg.ollamaEndpoint.trimmed();
        if (base.endsWith(QLatin1Char('/'))) base.chop(1);

        QJsonArray msgArr;
        if (!systemPrompt.isEmpty()) {
            msgArr.append(QJsonObject{{QStringLiteral("role"), QStringLiteral("system")}, {QStringLiteral("content"), systemPrompt}});
        }
        for (const QVariant &v : messages) {
            const QVariantMap m = v.toMap();
            msgArr.append(QJsonObject{
                {QStringLiteral("role"), m.value(QStringLiteral("role")).toString()},
                {QStringLiteral("content"), m.value(QStringLiteral("content")).toString()},
            });
        }

        QNetworkRequest req(QUrl(base + QStringLiteral("/api/chat")));
        req.setHeader(QNetworkRequest::ContentTypeHeader, QStringLiteral("application/json"));
        req.setTransferTimeout(60000);
        const QByteArray body = QJsonDocument(QJsonObject{
            {QStringLiteral("model"), cfg.ollamaModel},
            {QStringLiteral("messages"), msgArr},
            {QStringLiteral("stream"), false},
        }).toJson(QJsonDocument::Compact);

        QNetworkReply *reply = m_nam->post(req, body);
        connect(reply, &QNetworkReply::finished, this, [reply, cb]() {
            reply->deleteLater();
            if (reply->error() != QNetworkReply::NoError) {
                cb({}, reply->errorString());
                return;
            }
            const QJsonObject obj = QJsonDocument::fromJson(reply->readAll()).object();
            const QString content = obj.value(QStringLiteral("message")).toObject().value(QStringLiteral("content")).toString();
            cb(content, {});
        });
        return;
    }

    if (cfg.provider == QStringLiteral("gemini")) {
        const QString url = QStringLiteral("https://generativelanguage.googleapis.com/v1beta/models/%1:generateContent?key=%2")
                                .arg(cfg.geminiModel, cfg.geminiApiKey.trimmed());
        QJsonArray contents;
        for (const QVariant &v : messages) {
            const QVariantMap m = v.toMap();
            const QString role = m.value(QStringLiteral("role")).toString() == QStringLiteral("assistant")
                ? QStringLiteral("model")
                : QStringLiteral("user");
            contents.append(QJsonObject{
                {QStringLiteral("role"), role},
                {QStringLiteral("parts"), QJsonArray{QJsonObject{{QStringLiteral("text"), m.value(QStringLiteral("content")).toString()}}}},
            });
        }

        QJsonObject payload{{QStringLiteral("contents"), contents}};
        if (!systemPrompt.isEmpty()) {
            payload.insert(QStringLiteral("systemInstruction"), QJsonObject{
                {QStringLiteral("parts"), QJsonArray{QJsonObject{{QStringLiteral("text"), systemPrompt}}}}
            });
        }

        QNetworkRequest req{QUrl(url)};
        req.setHeader(QNetworkRequest::ContentTypeHeader, QStringLiteral("application/json"));
        req.setTransferTimeout(60000);
        QNetworkReply *reply = m_nam->post(req, QJsonDocument(payload).toJson(QJsonDocument::Compact));
        connect(reply, &QNetworkReply::finished, this, [reply, cb]() {
            reply->deleteLater();
            const QByteArray raw = reply->readAll();
            if (reply->error() != QNetworkReply::NoError) {
                const QString errMsg = QJsonDocument::fromJson(raw).object().value(QStringLiteral("error")).toObject().value(QStringLiteral("message")).toString();
                cb({}, errMsg.isEmpty() ? reply->errorString() : errMsg);
                return;
            }
            const QJsonObject obj = QJsonDocument::fromJson(raw).object();
            const QJsonArray cands = obj.value(QStringLiteral("candidates")).toArray();
            if (cands.isEmpty()) {
                cb({}, tr("No response candidates from Gemini."));
                return;
            }
            const QString text = cands.first().toObject().value(QStringLiteral("content")).toObject().value(QStringLiteral("parts")).toArray().first().toObject().value(QStringLiteral("text")).toString();
            cb(text, {});
        });
        return;
    }

    if (cfg.provider == QStringLiteral("openai")) {
        QJsonArray msgArr;
        if (!systemPrompt.isEmpty()) {
            msgArr.append(QJsonObject{{QStringLiteral("role"), QStringLiteral("system")}, {QStringLiteral("content"), systemPrompt}});
        }
        for (const QVariant &v : messages) {
            const QVariantMap m = v.toMap();
            msgArr.append(QJsonObject{
                {QStringLiteral("role"), m.value(QStringLiteral("role")).toString()},
                {QStringLiteral("content"), m.value(QStringLiteral("content")).toString()},
            });
        }

        QNetworkRequest req(QUrl(QStringLiteral("https://api.openai.com/v1/chat/completions")));
        req.setHeader(QNetworkRequest::ContentTypeHeader, QStringLiteral("application/json"));
        req.setRawHeader("Authorization", QByteArray("Bearer ") + cfg.openaiApiKey.trimmed().toUtf8());
        req.setTransferTimeout(60000);
        const QByteArray body = QJsonDocument(QJsonObject{
            {QStringLiteral("model"), cfg.openaiModel},
            {QStringLiteral("messages"), msgArr},
        }).toJson(QJsonDocument::Compact);

        QNetworkReply *reply = m_nam->post(req, body);
        connect(reply, &QNetworkReply::finished, this, [reply, cb]() {
            reply->deleteLater();
            const QByteArray raw = reply->readAll();
            if (reply->error() != QNetworkReply::NoError) {
                const QString errMsg = QJsonDocument::fromJson(raw).object().value(QStringLiteral("error")).toObject().value(QStringLiteral("message")).toString();
                cb({}, errMsg.isEmpty() ? reply->errorString() : errMsg);
                return;
            }
            const QJsonArray choices = QJsonDocument::fromJson(raw).object().value(QStringLiteral("choices")).toArray();
            if (choices.isEmpty()) {
                cb({}, tr("No choices returned by OpenAI."));
                return;
            }
            const QString content = choices.first().toObject().value(QStringLiteral("message")).toObject().value(QStringLiteral("content")).toString();
            cb(content, {});
        });
        return;
    }

    if (cfg.provider == QStringLiteral("anthropic")) {
        QJsonArray msgArr;
        for (const QVariant &v : messages) {
            const QVariantMap m = v.toMap();
            msgArr.append(QJsonObject{
                {QStringLiteral("role"), m.value(QStringLiteral("role")).toString()},
                {QStringLiteral("content"), m.value(QStringLiteral("content")).toString()},
            });
        }

        QNetworkRequest req(QUrl(QStringLiteral("https://api.anthropic.com/v1/messages")));
        req.setHeader(QNetworkRequest::ContentTypeHeader, QStringLiteral("application/json"));
        req.setRawHeader("x-api-key", cfg.anthropicApiKey.trimmed().toUtf8());
        req.setRawHeader("anthropic-version", "2023-06-01");
        req.setTransferTimeout(60000);

        QJsonObject payload{
            {QStringLiteral("model"), cfg.anthropicModel},
            {QStringLiteral("max_tokens"), 2048},
            {QStringLiteral("messages"), msgArr},
        };
        if (!systemPrompt.isEmpty()) {
            payload.insert(QStringLiteral("system"), systemPrompt);
        }

        QNetworkReply *reply = m_nam->post(req, QJsonDocument(payload).toJson(QJsonDocument::Compact));
        connect(reply, &QNetworkReply::finished, this, [reply, cb]() {
            reply->deleteLater();
            const QByteArray raw = reply->readAll();
            if (reply->error() != QNetworkReply::NoError) {
                const QString errMsg = QJsonDocument::fromJson(raw).object().value(QStringLiteral("error")).toObject().value(QStringLiteral("message")).toString();
                cb({}, errMsg.isEmpty() ? reply->errorString() : errMsg);
                return;
            }
            const QJsonArray content = QJsonDocument::fromJson(raw).object().value(QStringLiteral("content")).toArray();
            if (content.isEmpty()) {
                cb({}, tr("No content returned by Anthropic."));
                return;
            }
            cb(content.first().toObject().value(QStringLiteral("text")).toString(), {});
        });
        return;
    }

    cb({}, tr("Unsupported AI provider: %1").arg(cfg.provider));
}

void AiService::sendChatMessage(const QString &prompt, const QVariantList &history, const QVariantList &attachedTransactions)
{
    if (!m_settings || !m_settings->aiEnabled()) {
        Q_EMIT chatResponseReceived({}, tr("AI features are disabled in Settings."));
        return;
    }

    setBusy(true);
    QString systemPrompt = QStringLiteral(
        "You are Finly AI, a helpful personal finance advisor inside the Finly desktop app. "
        "Use the user's real financial context below to answer concisely and accurately.\n\n") + buildFinancialContext();

    if (!attachedTransactions.isEmpty()) {
        systemPrompt += QStringLiteral("\nAttached Transactions:\n");
        for (const QVariant &v : attachedTransactions) {
            const QVariantMap m = v.toMap();
            systemPrompt += QStringLiteral("- %1 | %2 | %3 | %4 | %5\n")
                                .arg(m.value(QStringLiteral("date")).toString(),
                                     m.value(QStringLiteral("payee")).toString(),
                                     m.value(QStringLiteral("category")).toString(),
                                     m.value(QStringLiteral("account")).toString(),
                                     QString::number(m.value(QStringLiteral("amount")).toDouble(), 'f', 2));
        }
    }

    QVariantList msgs = history;
    msgs.append(QVariantMap{{QStringLiteral("role"), QStringLiteral("user")}, {QStringLiteral("content"), prompt}});

    sendPrompt(m_settings->aiConfig(), systemPrompt, msgs, [this](const QString &reply, const QString &err) {
        setBusy(false);
        if (err.isEmpty() && m_notifications) {
            m_notifications->notify(QStringLiteral("Finly AI"), tr("Response ready"));
        }
        Q_EMIT chatResponseReceived(reply, err);
    });
}

void AiService::parseNaturalLanguageTransaction(const QString &text)
{
    if (!m_settings || !m_settings->aiEnabled()) {
        Q_EMIT transactionParsed({}, tr("AI features are disabled."));
        return;
    }
    setBusy(true);

    const QString cats = m_categories ? m_categories->categoryNames().join(QStringLiteral(", ")) : QStringLiteral("Other");
    const QString accs = m_accounts ? m_accounts->accountNames().join(QStringLiteral(", ")) : QStringLiteral("Checking");
    const QString sys = QStringLiteral(
        "Extract a financial transaction from the user's text and return ONLY valid JSON with keys: "
        "type (\"expense\"|\"income\"|\"transfer\"), amount (positive number), payee (string), "
        "category (one of: %1), account (one of: %2), date (YYYY-MM-DD, today is %3), notes (string).")
        .arg(cats, accs, QDate::currentDate().toString(Qt::ISODate));

    const QVariantList msgs = {QVariantMap{{QStringLiteral("role"), QStringLiteral("user")}, {QStringLiteral("content"), text}}};
    sendPrompt(m_settings->aiConfig(), sys, msgs, [this](const QString &reply, const QString &err) {
        setBusy(false);
        if (!err.isEmpty()) {
            Q_EMIT transactionParsed({}, err);
            return;
        }
        QString clean = reply.trimmed();
        const int start = clean.indexOf(QLatin1Char('{'));
        const int end = clean.lastIndexOf(QLatin1Char('}'));
        if (start >= 0 && end > start) {
            clean = clean.mid(start, end - start + 1);
        }
        const QJsonObject obj = QJsonDocument::fromJson(clean.toUtf8()).object();
        if (obj.isEmpty()) {
            Q_EMIT transactionParsed({}, tr("Could not parse JSON from AI response."));
            return;
        }
        Q_EMIT transactionParsed(obj.toVariantMap(), {});
    });
}

void AiService::generateHealthDigest()
{
    if (!m_settings || !m_settings->aiEnabled()) {
        Q_EMIT digestGenerated({}, tr("AI features are disabled."));
        return;
    }
    setBusy(true);

    const QString sys = QStringLiteral(
        "Analyze the user's financial snapshot and write a concise 3-bullet Financial Health Digest "
        "(Cash Flow & Savings, Top Spending Category, One Actionable Tip).\n\n") + buildFinancialContext();
    const QVariantList msgs = {QVariantMap{{QStringLiteral("role"), QStringLiteral("user")}, {QStringLiteral("content"), QStringLiteral("Generate my financial health digest.")}}};

    sendPrompt(m_settings->aiConfig(), sys, msgs, [this](const QString &reply, const QString &err) {
        setBusy(false);
        Q_EMIT digestGenerated(reply, err);
    });
}

void AiService::smartCategorizeBatch(const QVariantList &rows)
{
    if (!m_settings || !m_settings->aiEnabled()) {
        Q_EMIT batchCategorized({}, tr("AI features are disabled."));
        return;
    }
    setBusy(true);

    const QString cats = m_categories ? m_categories->categoryNames().join(QStringLiteral(", ")) : QStringLiteral("Other");
    QString itemsStr;
    for (const QVariant &v : rows) {
        const QVariantMap m = v.toMap();
        itemsStr += QStringLiteral("%1: %2 (%3)\n")
                        .arg(m.value(QStringLiteral("id")).toString(),
                             m.value(QStringLiteral("payee")).toString(),
                             m.value(QStringLiteral("notes")).toString());
    }

    const QString sys = QStringLiteral(
        "Categorize each transaction ID below into one of [%1]. Return ONLY a JSON object mapping id -> category.\n")
        .arg(cats);
    const QVariantList msgs = {QVariantMap{{QStringLiteral("role"), QStringLiteral("user")}, {QStringLiteral("content"), itemsStr}}};

    sendPrompt(m_settings->aiConfig(), sys, msgs, [this](const QString &reply, const QString &err) {
        setBusy(false);
        if (!err.isEmpty()) {
            Q_EMIT batchCategorized({}, err);
            return;
        }
        QString clean = reply.trimmed();
        const int start = clean.indexOf(QLatin1Char('{'));
        const int end = clean.lastIndexOf(QLatin1Char('}'));
        if (start >= 0 && end > start) {
            clean = clean.mid(start, end - start + 1);
        }
        const QJsonObject obj = QJsonDocument::fromJson(clean.toUtf8()).object();
        Q_EMIT batchCategorized(obj.toVariantMap(), {});
    });
}

} // namespace Finly
