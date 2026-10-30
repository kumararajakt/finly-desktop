use rusqlite::{params, Connection, Result};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Mutex;
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Transaction {
    pub id: String,
    pub date: String,
    pub payee: String,
    pub category: String,
    #[serde(rename = "categoryColor")]
    pub category_color: Option<String>,
    pub account: String,
    pub amount: f64,
    #[serde(rename = "type")]
    pub tx_type: String,
    pub status: String,
    pub notes: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct NewTransaction {
    pub date: String,
    pub payee: String,
    pub category: String,
    #[serde(rename = "categoryColor")]
    pub category_color: Option<String>,
    pub account: String,
    pub amount: f64,
    #[serde(rename = "type")]
    pub tx_type: String,
    pub status: String,
    pub notes: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Account {
    pub id: String,
    pub name: String,
    #[serde(rename = "type")]
    pub account_type: String,
    pub balance: f64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct NewAccount {
    pub name: String,
    #[serde(rename = "type")]
    pub account_type: String,
    pub balance: Option<f64>,
}

pub struct DbState {
    pub conn: Mutex<Connection>,
}

impl DbState {
    pub fn new(db_path: PathBuf) -> Result<Self, rusqlite::Error> {
        if let Some(parent) = db_path.parent() {
            let _ = std::fs::create_dir_all(parent);
        }

        let conn = Connection::open(db_path)?;

        // Performance pragmas
        conn.execute_batch(
            "PRAGMA journal_mode = WAL;
             PRAGMA synchronous = NORMAL;
             PRAGMA foreign_keys = ON;",
        )?;

        // Create tables
        conn.execute(
            "CREATE TABLE IF NOT EXISTS accounts (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL UNIQUE,
                account_type TEXT NOT NULL,
                balance REAL NOT NULL DEFAULT 0.0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )",
            [],
        )?;

        conn.execute(
            "CREATE TABLE IF NOT EXISTS transactions (
                id TEXT PRIMARY KEY,
                date TEXT NOT NULL,
                payee TEXT NOT NULL,
                category TEXT NOT NULL,
                category_color TEXT,
                account TEXT NOT NULL,
                amount REAL NOT NULL,
                tx_type TEXT NOT NULL,
                status TEXT NOT NULL,
                notes TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )",
            [],
        )?;

        conn.execute(
            "CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            )",
            [],
        )?;

        // Indexes for fast searching and filtering
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions (date DESC)",
            [],
        )?;
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_transactions_account ON transactions (account)",
            [],
        )?;
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions (status)",
            [],
        )?;

        Ok(DbState {
            conn: Mutex::new(conn),
        })
    }

    pub fn get_transactions(&self) -> Result<Vec<Transaction>, rusqlite::Error> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, date, payee, category, category_color, account, amount, tx_type, status, notes
             FROM transactions
             ORDER BY date DESC, created_at DESC",
        )?;

        let tx_iter = stmt.query_map([], |row| {
            Ok(Transaction {
                id: row.get(0)?,
                date: row.get(1)?,
                payee: row.get(2)?,
                category: row.get(3)?,
                category_color: row.get(4)?,
                account: row.get(5)?,
                amount: row.get(6)?,
                tx_type: row.get(7)?,
                status: row.get(8)?,
                notes: row.get(9)?,
            })
        })?;

        let mut transactions = Vec::new();
        for tx in tx_iter {
            transactions.push(tx?);
        }
        Ok(transactions)
    }

    pub fn add_transaction(&self, new_tx: NewTransaction) -> Result<Transaction, rusqlite::Error> {
        let mut conn = self.conn.lock().unwrap();
        let tx = conn.transaction()?;

        let id = Uuid::new_v4().to_string();

        tx.execute(
            "INSERT INTO transactions (id, date, payee, category, category_color, account, amount, tx_type, status, notes)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
            params![
                id,
                new_tx.date,
                new_tx.payee,
                new_tx.category,
                new_tx.category_color,
                new_tx.account,
                new_tx.amount,
                new_tx.tx_type,
                new_tx.status,
                new_tx.notes
            ],
        )?;

        // Update or insert account balance
        let updated_rows = tx.execute(
            "UPDATE accounts SET balance = balance + ?1 WHERE name = ?2",
            params![new_tx.amount, new_tx.account],
        )?;

        if updated_rows == 0 {
            let acc_id = Uuid::new_v4().to_string();
            let acc_type = if new_tx.account.to_lowercase().contains("credit") {
                "credit"
            } else {
                "checking"
            };
            tx.execute(
                "INSERT INTO accounts (id, name, account_type, balance) VALUES (?1, ?2, ?3, ?4)",
                params![acc_id, new_tx.account, acc_type, new_tx.amount],
            )?;
        }

        tx.commit()?;

        Ok(Transaction {
            id,
            date: new_tx.date,
            payee: new_tx.payee,
            category: new_tx.category,
            category_color: new_tx.category_color,
            account: new_tx.account,
            amount: new_tx.amount,
            tx_type: new_tx.tx_type,
            status: new_tx.status,
            notes: new_tx.notes,
        })
    }

    pub fn delete_transaction(&self, id: &str) -> Result<bool, rusqlite::Error> {
        let mut conn = self.conn.lock().unwrap();
        let tx = conn.transaction()?;

        // Retrieve transaction first to revert balance
        let found: Option<(String, f64)> = tx
            .query_row(
                "SELECT account, amount FROM transactions WHERE id = ?1",
                params![id],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .ok();

        if let Some((account, amount)) = found {
            tx.execute(
                "UPDATE accounts SET balance = balance - ?1 WHERE name = ?2",
                params![amount, account],
            )?;

            tx.execute("DELETE FROM transactions WHERE id = ?1", params![id])?;
            tx.commit()?;
            Ok(true)
        } else {
            Ok(false)
        }
    }

    pub fn toggle_flag(&self, id: &str) -> Result<String, rusqlite::Error> {
        let conn = self.conn.lock().unwrap();
        let current_status: String = conn.query_row(
            "SELECT status FROM transactions WHERE id = ?1",
            params![id],
            |row| row.get(0),
        )?;

        let new_status = if current_status == "flagged" {
            "cleared"
        } else {
            "flagged"
        };

        conn.execute(
            "UPDATE transactions SET status = ?1 WHERE id = ?2",
            params![new_status, id],
        )?;

        Ok(new_status.to_string())
    }

    pub fn import_transactions(&self, transactions: Vec<NewTransaction>) -> Result<usize, rusqlite::Error> {
        let mut conn = self.conn.lock().unwrap();
        let tx = conn.transaction()?;

        let mut count = 0;
        for new_tx in transactions {
            let id = Uuid::new_v4().to_string();
            tx.execute(
                "INSERT INTO transactions (id, date, payee, category, category_color, account, amount, tx_type, status, notes)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
                params![
                    id,
                    new_tx.date,
                    new_tx.payee,
                    new_tx.category,
                    new_tx.category_color,
                    new_tx.account,
                    new_tx.amount,
                    new_tx.tx_type,
                    new_tx.status,
                    new_tx.notes
                ],
            )?;

            let updated_rows = tx.execute(
                "UPDATE accounts SET balance = balance + ?1 WHERE name = ?2",
                params![new_tx.amount, new_tx.account],
            )?;

            if updated_rows == 0 {
                let acc_id = Uuid::new_v4().to_string();
                let acc_type = if new_tx.account.to_lowercase().contains("credit") {
                    "credit"
                } else {
                    "checking"
                };
                tx.execute(
                    "INSERT INTO accounts (id, name, account_type, balance) VALUES (?1, ?2, ?3, ?4)",
                    params![acc_id, new_tx.account, acc_type, new_tx.amount],
                )?;
            }
            count += 1;
        }

        tx.commit()?;
        Ok(count)
    }

    pub fn add_account(&self, new_acc: NewAccount) -> Result<Account, rusqlite::Error> {
        let conn = self.conn.lock().unwrap();
        let id = Uuid::new_v4().to_string();
        let balance = new_acc.balance.unwrap_or(0.0);

        conn.execute(
            "INSERT INTO accounts (id, name, account_type, balance) VALUES (?1, ?2, ?3, ?4)",
            params![id, new_acc.name, new_acc.account_type, balance],
        )?;

        Ok(Account {
            id,
            name: new_acc.name,
            account_type: new_acc.account_type,
            balance,
        })
    }

    pub fn get_accounts(&self) -> Result<Vec<Account>, rusqlite::Error> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, name, account_type, balance
             FROM accounts
             ORDER BY name ASC",
        )?;

        let acc_iter = stmt.query_map([], |row| {
            Ok(Account {
                id: row.get(0)?,
                name: row.get(1)?,
                account_type: row.get(2)?,
                balance: row.get(3)?,
            })
        })?;

        let mut accounts = Vec::new();
        for acc in acc_iter {
            accounts.push(acc?);
        }
        Ok(accounts)
    }

    pub fn get_setting(&self, key: &str) -> Result<Option<String>, rusqlite::Error> {
        let conn = self.conn.lock().unwrap();
        let res: Option<String> = conn
            .query_row(
                "SELECT value FROM settings WHERE key = ?1",
                params![key],
                |row| row.get(0),
            )
            .ok();
        Ok(res)
    }

    pub fn set_setting(&self, key: &str, value: &str) -> Result<(), rusqlite::Error> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO settings (key, value) VALUES (?1, ?2)
             ON CONFLICT(key) DO UPDATE SET value = ?2",
            params![key, value],
        )?;
        Ok(())
    }
}
