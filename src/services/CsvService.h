#pragma once

#include "../models/TransactionModel.h"

#include <QObject>
#include <QVariantList>
#include <QVariantMap>

namespace Finly {

class CsvService : public QObject
{
    Q_OBJECT

public:
    explicit CsvService(QObject *parent = nullptr);

    Q_INVOKABLE QString pickCsvFile();
    Q_INVOKABLE QVariantMap parseCsvFile(const QString &filePath);
    Q_INVOKABLE QString normalizeDate(const QString &rawDate, const QString &formatHint = QStringLiteral("auto")) const;
    Q_INVOKABLE QString guessCategory(const QString &payee, const QString &notes = QString()) const;
    Q_INVOKABLE QString exportTransactionsToCsv(QObject *proxyModelObj, const QString &defaultFilename);

private:
    static QVector<QStringList> parseRfc4180(const QString &content);
    static QString escapeCsvField(const QString &field);
};

} // namespace Finly
