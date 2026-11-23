# Finly Desktop (KDE Kirigami)

A native Linux desktop personal finance manager built with **C++20**, **Qt 6**, **KDE Kirigami**, and **SQLite**.

## Tech Stack
- **UI**: QML + KDE Kirigami (`org.kde.kirigami`)
- **Backend**: C++20, Qt6 (`Core`, `Quick`, `Qml`, `QuickControls2`, `Sql`, `Network`, `Widgets`)
- **KDE Frameworks**: `KF6Kirigami`, `KF6I18n`, `KF6CoreAddons`, `KF6Config`, `KF6Notifications`
- **Database**: Local SQLite (`QSQLITE`)
- **Build System**: CMake + Extra CMake Modules (ECM)

## Building & Running

### Arch Linux Dependencies
```bash
sudo pacman -S --needed cmake ninja extra-cmake-modules qt6-base qt6-declarative kirigami ki18n kcoreaddons kconfig knotifications qqc2-desktop-style
```

### Build
```bash
cmake -B build -G Ninja
cmake --build build
./build/bin/finly
```

## License
MIT
