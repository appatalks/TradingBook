# TradingBook - Advanced Trading Journal

A comprehensive, open-source trading journal application built with Electron and React. TradingBook provides all the features of premium trading journals like Tradervue, but completely free and with full data ownership.

## 📸 Screenshots

![TradingBook Interface](https://raw.githubusercontent.com/appatalks/TradingBook/main/assets/tradingbook-screenshot.png)

*TradingBook's clean and intuitive interface showing the dashboard with P&L calendar and trade analytics*

### More Screenshots

<div align="center">
  <a href="https://raw.githubusercontent.com/appatalks/TradingBook/main/assets/add-trade.png">
    <img src="https://raw.githubusercontent.com/appatalks/TradingBook/main/assets/add-trade.png" alt="Add Trade" width="175" style="margin: 5px;">
  </a>
  <a href="https://raw.githubusercontent.com/appatalks/TradingBook/main/assets/trades.png">
    <img src="https://raw.githubusercontent.com/appatalks/TradingBook/main/assets/trades.png" alt="Trades List" width="175" style="margin: 5px;">
  </a>
  <a href="https://raw.githubusercontent.com/appatalks/TradingBook/main/assets/analytics.png">
    <img src="https://raw.githubusercontent.com/appatalks/TradingBook/main/assets/analytics.png" alt="Analytics" width="175" style="margin: 5px;">
  </a>
  <a href="https://raw.githubusercontent.com/appatalks/TradingBook/main/assets/summary.png">
    <img src="https://raw.githubusercontent.com/appatalks/TradingBook/main/assets/summary.png" alt="Summary" width="175" style="margin: 5px;">
  </a>
  <a href="https://raw.githubusercontent.com/appatalks/TradingBook/main/assets/settings.png">
    <img src="https://raw.githubusercontent.com/appatalks/TradingBook/main/assets/settings.png" alt="Settings" width="175" style="margin: 5px;">
  </a>
</div>

### Core Features
- **📊 P&L Calendar**: Visual calendar showing daily profits/losses with color coding
- **📈 Advanced Analytics**: Win rate, profit factor, Sharpe ratio, max drawdown
- **💰 Multi-Asset Support**: Stocks, options, crypto, forex
- **🔍 Trade Management**: Add, edit, delete, search, and filter trades
- **📱 Modern UI**: Clean, responsive interface with dark/light themes

### Why Choose TradingBook?
- ✅ **Completely Free** - No subscription fees
- ✅ **Data Privacy** - Your data stays on your machine
- ✅ **Offline First** - No internet required
- ✅ **Open Source** - Full transparency and customization
- ✅ **Cross Platform** - Linux AppImage & Windows installer/portable
- ✅ **No Installation** - Portable executables, no admin rights needed
- ✅ **No Data Limits** - Track unlimited trades

## 📋 Quick Start

### Download & Run (No Installation Required!)

#### 🐧 Linux AppImage
1. Download `TradingBook-1.0.3.AppImage` from [Releases](https://github.com/appatalks/TradingBook/releases)
2. Make executable: `chmod +x TradingBook-1.0.3.AppImage`
3. Run: `./TradingBook-1.0.3.AppImage`

#### 🪟 Windows
**Installer (Recommended)**
1. Download `TradingBook Setup 1.0.3.exe` from [Releases](https://github.com/appatalks/TradingBook/releases)
2. Run installer and follow prompts
3. Launch from Start Menu or desktop shortcut

## 💡 Usage Guide

### Adding Trades
1. Navigate to "New Trade" in the sidebar
2. Fill in trade details (symbol, side, quantity, prices)
3. Add optional information (strategy, notes, option details)
4. Save the trade

### Viewing Analytics
1. Go to "Analytics" to see performance metrics
2. Filter by date ranges
3. View symbol and strategy breakdowns
4. Track win/loss ratios and risk metrics

### P&L Calendar
1. Visit "Dashboard" for the monthly P&L calendar
2. Green days = profit, red days = losses
3. Click on any day to see trade details
4. Navigate between months and years

## 🔧 Advanced Usage

### Match P&L Feature
The "Match P&L" button in Settings is used to automatically pair buy and sell trades to calculate profits and losses. This is especially useful when:

- **Importing CSV data** from brokers that list buy and sell orders as separate entries
- **Managing partial fills** where large orders were executed in multiple smaller trades  
- **Calculating accurate P&L** for complex trading scenarios with multiple entry/exit points

**How it works:**
- Uses FIFO (First In, First Out) matching algorithm
- Pairs buy orders with sell orders for the same symbol
- Automatically calculates P&L including commissions
- Handles partial fills by creating remainder trades
- Creates complete trade records with entry/exit prices and dates

**When to use:** After CSV imports or when you have unmatched buy/sell pairs that need P&L calculation.

## 📊 TradingBook vs. Tradervue

| Feature | TradingBook | Tradervue |
|---------|------------|------------|
| **Price** | Free | $49+/month |
| **Platforms** | Linux, Windows (portable) | Web-based |
| **Data Ownership** | You own it | Cloud-hosted |
| **Internet Required** | No | Yes |
| **Installation** | None (portable) | Browser required |
| **Trade Limits** | Unlimited | Plan-dependent |
| **Open Source** | Yes | No |
| **Custom Analytics** | Extensible | Fixed |

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

## 🔒 Privacy & Security

- **No Data Collection**: We don't collect any user data
- **Local Storage**: All data stored locally in SQLite
- **No Network Requests**: No data sent to external servers
- **Open Source**: Code is fully auditable
- **Portable**: No installation or registry modifications
- **Self-Contained**: All dependencies bundled, no system changes

---

📈 *Start tracking your trading performance today with TradingBook!*
