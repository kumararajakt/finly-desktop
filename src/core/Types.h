#pragma once

#include <QString>
#include <QVector>

namespace Finly {

struct Account {
    QString id;
    QString name;
    QString type; // "checking" | "savings" | "credit" | "investment" | "loan"
    double balance = 0.0;
};

struct Transaction {
    QString id;
    QString date;          // YYYY-MM-DD
    QString payee;
    QString category;
    QString categoryColor;
    QString account;
    QString toAccount;
    double amount = 0.0;   // positive for income, negative for expense
    QString type;          // "expense" | "income" | "transfer"
    QString status;        // "cleared" | "pending" | "reconciled" | "flagged"
    QString notes;
};

struct UserProfile {
    QString name;
    QString country;
    QString currencyCode;
    QString currencySymbol;
};

struct CountryCurrency {
    QString country;
    QString code;
    QString currencyCode;
    QString currencyName;
    QString symbol;
};

struct BudgetItem {
    QString id;
    QString category;
    double limit = 0.0;
    QString period = QStringLiteral("monthly"); // "monthly" | "yearly"
    QString color;
};

struct CategoryItem {
    QString id;
    QString name;
    QString color;
    QString type; // "expense" | "income" | "both"
    QString icon;
    QString description;
    bool isDefault = false;
};

struct LoanRecord {
    QString id;
    QString contactName;
    QString type; // "lent" | "borrowed"
    double initialAmount = 0.0;
    double remainingAmount = 0.0;
    QString account;
    QString startDate;
    QString dueDate;
    QString notes;
    QString status = QStringLiteral("active"); // "active" | "settled"
};

struct LoanPayment {
    QString id;
    QString loanId;
    QString contactName;
    QString date;
    double amount = 0.0;
    QString account;
    QString notes;
};

struct AIConfig {
    bool enabled = false;
    QString provider = QStringLiteral("ollama"); // "ollama" | "gemini" | "openai" | "anthropic"
    QString ollamaEndpoint = QStringLiteral("http://localhost:11434");
    QString ollamaModel = QStringLiteral("llama3.2");
    QString geminiApiKey;
    QString geminiModel = QStringLiteral("gemini-1.5-flash");
    QString openaiApiKey;
    QString openaiModel = QStringLiteral("gpt-4o-mini");
    QString anthropicApiKey;
    QString anthropicModel = QStringLiteral("claude-3-5-haiku-20241022");
};

} // namespace Finly
