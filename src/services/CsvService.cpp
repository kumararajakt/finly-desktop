#include "CsvService.h"

#include <QDate>
#include <QFile>
#include <QFileDialog>
#include <QFileInfo>
#include <QStandardPaths>
#include <QTextStream>
#include <QUrl>

namespace Finly {

CsvService::CsvService(QObject *parent)
    : QObject(parent)
{
}

QString CsvService::pickCsvFile()
{
    const QString docsDir = QStandardPaths::writableLocation(QStandardPaths::DocumentsLocation);
    return QFileDialog::getOpenFileName(
        nullptr,
        tr("Select CSV Statement"),
        docsDir,
        tr("CSV Files (*.csv);;All Files (*)")
    );
}

QVector<QStringList> CsvService::parseRfc4180(const QString &content)
{
    QVector<QStringList> rows;
    QStringList currentRow;
    QString currentField;
    bool inQuotes = false;

    for (int i = 0; i < content.size(); ++i) {
        const QChar c = content.at(i);
        if (inQuotes) {
            if (c == QLatin1Char('"')) {
                if (i + 1 < content.size() && content.at(i + 1) == QLatin1Char('"')) {
                    currentField += QLatin1Char('"');
                    ++i;
                } else {
                    inQuotes = false;
                }
            } else {
                currentField += c;
            }
        } else {
            if (c == QLatin1Char('"')) {
                inQuotes = true;
            } else if (c == QLatin1Char(',')) {
                currentRow.append(currentField.trimmed());
                currentField.clear();
            } else if (c == QLatin1Char('\r') || c == QLatin1Char('\n')) {
                if (c == QLatin1Char('\r') && i + 1 < content.size() && content.at(i + 1) == QLatin1Char('\n')) {
                    ++i;
                }
                currentRow.append(currentField.trimmed());
                currentField.clear();
                bool nonEmpty = false;
                for (const QString &f : currentRow) {
                    if (!f.isEmpty()) {
                        nonEmpty = true;
                        break;
                    }
                }
                if (nonEmpty) {
                    rows.append(currentRow);
                }
                currentRow.clear();
            } else {
                currentField += c;
            }
        }
    }

    if (!currentField.isEmpty() || !currentRow.isEmpty()) {
        currentRow.append(currentField.trimmed());
        rows.append(currentRow);
    }
    return rows;
}

QVariantMap CsvService::parseCsvFile(const QString &filePath)
{
    QString localPath = filePath;
    if (localPath.startsWith(QStringLiteral("file://"))) {
        localPath = QUrl(localPath).toLocalFile();
    }

    QFile file(localPath);
    if (!file.open(QIODevice::ReadOnly | QIODevice::Text)) {
        return {
            {QStringLiteral("ok"), false},
            {QStringLiteral("error"), file.errorString()},
        };
    }

    QTextStream in(&file);
    const QString content = in.readAll();
    const QVector<QStringList> parsed = parseRfc4180(content);

    if (parsed.isEmpty()) {
        return {
            {QStringLiteral("ok"), false},
            {QStringLiteral("error"), tr("CSV file is empty.")},
        };
    }

    const QStringList headers = parsed.first();
    QVariantList dataRows;
    for (int r = 1; r < parsed.size(); ++r) {
        QVariantMap rowMap;
        const QStringList &vals = parsed.at(r);
        for (int c = 0; c < headers.size(); ++c) {
            rowMap.insert(headers.at(c), c < vals.size() ? vals.at(c) : QString());
        }
        dataRows.append(rowMap);
    }

    QStringList sampleLines;
    for (int i = 0; i < qMin(5, parsed.size()); ++i) {
        sampleLines.append(parsed.at(i).join(QStringLiteral(", ")));
    }

    return {
        {QStringLiteral("ok"), true},
        {QStringLiteral("fileName"), QFileInfo(localPath).fileName()},
        {QStringLiteral("headers"), headers},
        {QStringLiteral("rows"), dataRows},
        {QStringLiteral("sampleText"), sampleLines.join(QStringLiteral("\n"))},
    };
}

QString CsvService::normalizeDate(const QString &rawDate, const QString &formatHint) const
{
    const QString trimmed = rawDate.trimmed();
    if (trimmed.isEmpty()) {
        return QDate::currentDate().toString(Qt::ISODate);
    }

    QStringList formats;
    if (formatHint == QStringLiteral("DD/MM/YYYY")) {
        formats = {QStringLiteral("dd/MM/yyyy"), QStringLiteral("dd-MM-yyyy"), QStringLiteral("d/M/yyyy")};
    } else if (formatHint == QStringLiteral("MM/DD/YYYY")) {
        formats = {QStringLiteral("MM/dd/yyyy"), QStringLiteral("MM-dd-yyyy"), QStringLiteral("M/d/yyyy")};
    } else if (formatHint == QStringLiteral("YYYY-MM-DD")) {
        formats = {QStringLiteral("yyyy-MM-dd"), QStringLiteral("yyyy/MM/dd")};
    } else {
        formats = {
            QStringLiteral("yyyy-MM-dd"),
            QStringLiteral("yyyy/MM/dd"),
            QStringLiteral("dd/MM/yyyy"),
            QStringLiteral("dd-MM-yyyy"),
            QStringLiteral("MM/dd/yyyy"),
            QStringLiteral("MM-dd-yyyy"),
            QStringLiteral("d/M/yyyy"),
            QStringLiteral("dd MMM yyyy"),
        };
    }

    for (const QString &fmt : formats) {
        const QDate d = QDate::fromString(trimmed.left(10), fmt);
        if (d.isValid()) {
            return d.toString(Qt::ISODate);
        }
    }
    const QDate iso = QDate::fromString(trimmed.left(10), Qt::ISODate);
    return iso.isValid() ? iso.toString(Qt::ISODate) : QDate::currentDate().toString(Qt::ISODate);
}

QString CsvService::guessCategory(const QString &payee, const QString &notes) const
{
    const QString text = (payee + QLatin1Char(' ') + notes).toLower();
    if (text.contains(QStringLiteral("salary")) || text.contains(QStringLiteral("payroll")) || text.contains(QStringLiteral("stipend"))) {
        return QStringLiteral("Salary");
    }
    if (text.contains(QStringLiteral("grocery")) || text.contains(QStringLiteral("supermarket")) || text.contains(QStringLiteral("bigbasket")) || text.contains(QStringLiteral("blinkit")) || text.contains(QStringLiteral("zepto")) || text.contains(QStringLiteral("trader joe")) || text.contains(QStringLiteral("whole foods"))) {
        return QStringLiteral("Groceries");
    }
    if (text.contains(QStringLiteral("swiggy")) || text.contains(QStringLiteral("zomato")) || text.contains(QStringLiteral("uber eats")) || text.contains(QStringLiteral("restaurant")) || text.contains(QStringLiteral("cafe")) || text.contains(QStringLiteral("starbucks")) || text.contains(QStringLiteral("coffee"))) {
        return QStringLiteral("Dining Out");
    }
    if (text.contains(QStringLiteral("uber")) || text.contains(QStringLiteral("ola")) || text.contains(QStringLiteral("metro")) || text.contains(QStringLiteral("fuel")) || text.contains(QStringLiteral("petrol")) || text.contains(QStringLiteral("flight")) || text.contains(QStringLiteral("airline"))) {
        return QStringLiteral("Transportation");
    }
    if (text.contains(QStringLiteral("rent")) || text.contains(QStringLiteral("mortgage")) || text.contains(QStringLiteral("maintenance"))) {
        return QStringLiteral("Housing");
    }
    if (text.contains(QStringLiteral("electric")) || text.contains(QStringLiteral("water")) || text.contains(QStringLiteral("internet")) || text.contains(QStringLiteral("broadband")) || text.contains(QStringLiteral("mobile")) || text.contains(QStringLiteral("recharge"))) {
        return QStringLiteral("Utilities");
    }
    if (text.contains(QStringLiteral("netflix")) || text.contains(QStringLiteral("spotify")) || text.contains(QStringLiteral("movie")) || text.contains(QStringLiteral("cinema")) || text.contains(QStringLiteral("steam"))) {
        return QStringLiteral("Entertainment");
    }
    if (text.contains(QStringLiteral("pharmacy")) || text.contains(QStringLiteral("hospital")) || text.contains(QStringLiteral("doctor")) || text.contains(QStringLiteral("clinic")) || text.contains(QStringLiteral("medical"))) {
        return QStringLiteral("Healthcare");
    }
    if (text.contains(QStringLiteral("amazon")) || text.contains(QStringLiteral("flipkart")) || text.contains(QStringLiteral("myntra")) || text.contains(QStringLiteral("target")) || text.contains(QStringLiteral("walmart"))) {
        return QStringLiteral("Shopping");
    }
    if (text.contains(QStringLiteral("hotel")) || text.contains(QStringLiteral("airbnb")) || text.contains(QStringLiteral("booking.com"))) {
        return QStringLiteral("Travel");
    }
    return QStringLiteral("Other");
}

QString CsvService::escapeCsvField(const QString &field)
{
    if (field.contains(QLatin1Char(',')) || field.contains(QLatin1Char('"')) || field.contains(QLatin1Char('\n'))) {
        QString escaped = field;
        escaped.replace(QStringLiteral("\""), QStringLiteral("\"\""));
        return QLatin1Char('"') + escaped + QLatin1Char('"');
    }
    return field;
}

QString CsvService::exportTransactionsToCsv(QObject *proxyModelObj, const QString &defaultFilename)
{
    auto *model = qobject_cast<QAbstractItemModel *>(proxyModelObj);
    if (!model) {
        return {};
    }

    const QString docsDir = QStandardPaths::writableLocation(QStandardPaths::DocumentsLocation);
    const QString savePath = QFileDialog::getSaveFileName(
        nullptr,
        tr("Export Transactions to CSV"),
        docsDir + QLatin1Char('/') + defaultFilename,
        tr("CSV Files (*.csv)")
    );
    if (savePath.isEmpty()) {
        return {};
    }

    QFile file(savePath);
    if (!file.open(QIODevice::WriteOnly | QIODevice::Text)) {
        return {};
    }

    QTextStream out(&file);
    out << "Date,Payee,Category,Account,ToAccount,Amount,Type,Status,Notes\n";

    const int rows = model->rowCount();
    for (int r = 0; r < rows; ++r) {
        const QModelIndex idx = model->index(r, 0);
        const QStringList cols = {
            escapeCsvField(idx.data(TransactionModel::DateRole).toString()),
            escapeCsvField(idx.data(TransactionModel::PayeeRole).toString()),
            escapeCsvField(idx.data(TransactionModel::CategoryRole).toString()),
            escapeCsvField(idx.data(TransactionModel::AccountRole).toString()),
            escapeCsvField(idx.data(TransactionModel::ToAccountRole).toString()),
            QString::number(idx.data(TransactionModel::AmountRole).toDouble(), 'f', 2),
            escapeCsvField(idx.data(TransactionModel::TypeRole).toString()),
            escapeCsvField(idx.data(TransactionModel::StatusRole).toString()),
            escapeCsvField(idx.data(TransactionModel::NotesRole).toString()),
        };
        out << cols.join(QLatin1Char(',')) << '\n';
    }

    return savePath;
}

} // namespace Finly
