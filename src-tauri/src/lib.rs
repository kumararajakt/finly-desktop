mod db;

use db::{Account, DbState, NewAccount, NewTransaction, Transaction};
use std::path::PathBuf;
use tauri::Manager;

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
fn get_transactions(state: tauri::State<'_, DbState>) -> Result<Vec<Transaction>, String> {
    state.get_transactions().map_err(|e| e.to_string())
}

#[tauri::command]
fn add_transaction(
    state: tauri::State<'_, DbState>,
    transaction: NewTransaction,
) -> Result<Transaction, String> {
    state.add_transaction(transaction).map_err(|e| e.to_string())
}

#[tauri::command]
fn update_transaction(
    state: tauri::State<'_, DbState>,
    transaction: Transaction,
) -> Result<Transaction, String> {
    state.update_transaction(transaction).map_err(|e| e.to_string())
}

#[tauri::command]
fn delete_transaction(state: tauri::State<'_, DbState>, id: String) -> Result<bool, String> {
    state.delete_transaction(&id).map_err(|e| e.to_string())
}

#[tauri::command]
fn toggle_flag_transaction(state: tauri::State<'_, DbState>, id: String) -> Result<String, String> {
    state.toggle_flag(&id).map_err(|e| e.to_string())
}

#[tauri::command]
fn import_transactions(
    state: tauri::State<'_, DbState>,
    transactions: Vec<NewTransaction>,
) -> Result<usize, String> {
    state
        .import_transactions(transactions)
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn get_accounts(state: tauri::State<'_, DbState>) -> Result<Vec<Account>, String> {
    state.get_accounts().map_err(|e| e.to_string())
}

#[tauri::command]
fn add_account(state: tauri::State<'_, DbState>, account: NewAccount) -> Result<Account, String> {
    state.add_account(account).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_setting(state: tauri::State<'_, DbState>, key: String) -> Result<Option<String>, String> {
    state.get_setting(&key).map_err(|e| e.to_string())
}

#[tauri::command]
fn set_setting(state: tauri::State<'_, DbState>, key: String, value: String) -> Result<(), String> {
    state.set_setting(&key, &value).map_err(|e| e.to_string())
}

#[tauri::command]
async fn save_csv_file(default_filename: String, content: String) -> Result<Option<String>, String> {
    let file = rfd::AsyncFileDialog::new()
        .set_file_name(&default_filename)
        .add_filter("CSV Files (*.csv)", &["csv"])
        .save_file()
        .await;

    if let Some(file_handle) = file {
        file_handle
            .write(content.as_bytes())
            .await
            .map_err(|e| e.to_string())?;
        Ok(Some(file_handle.path().to_string_lossy().to_string()))
    } else {
        Ok(None)
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let app_data_dir = app
                .path()
                .app_data_dir()
                .unwrap_or_else(|_| PathBuf::from("."));
            let db_path = app_data_dir.join("finly.db");
            let db_state =
                DbState::new(db_path).expect("Failed to initialize SQLite database for Finly");
            app.manage(db_state);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            greet,
            get_transactions,
            add_transaction,
            update_transaction,
            delete_transaction,
            toggle_flag_transaction,
            import_transactions,
            get_accounts,
            add_account,
            get_setting,
            set_setting,
            save_csv_file
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
